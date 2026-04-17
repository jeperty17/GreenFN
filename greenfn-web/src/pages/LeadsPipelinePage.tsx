/**
 * Container for the Leads Pipeline page.
 * Owns all state and data fetching; wraps the board in a DndContext for drag-and-drop.
 * On drag end: optimistically moves the card and opens the transition modal.
 * The PATCH to persist the stage change is only called once the user completes or skips
 * both modal steps — not before. Undo in the modal reverts the card with no API call.
 */

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import PipelineBoard, {
  type PipelineStage,
} from "../components/pipeline/PipelineBoard";
import type { PipelineContact } from "../components/pipeline/types";
import StageTransitionModal, {
  type PendingTransition,
  type TransitionCompletionPayload,
} from "../components/pipeline/StageTransitionModal";
import ManageStagesModal from "../components/pipeline/ManageStagesModal";

interface ContactListItem {
  id: string;
  fullName: string;
  type: "LEAD" | "CLIENT";
  source: string | null;
}

interface FollowUpSuggestion {
  contactId: string;
  triggered: boolean;
  triggerType: string;
  contactName: string;
  fromStageName: string;
  toStageName: string;
  message: string;
  suggestedDueDateYmd: string;
  suggestedTaskTitle: string;
}

function ymdToDateInputValue(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) {
    return "";
  }

  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function daysSinceLabel(lastInteractionAt: string | null): string {
  if (!lastInteractionAt) return "No contact";
  const days = Math.floor(
    (Date.now() - new Date(lastInteractionAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (
      typeof payload?.error?.message === "string" &&
      payload.error.message.trim()
    ) {
      return payload.error.message;
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (
      Array.isArray(payload?.error?.details) &&
      payload.error.details.length > 0 &&
      typeof payload.error.details[0]?.message === "string"
    ) {
      return payload.error.details[0].message;
    }
    if (
      Array.isArray(payload?.details) &&
      payload.details.length > 0 &&
      typeof payload.details[0]?.message === "string"
    ) {
      return payload.details[0].message;
    }
  } catch {
    // ignore parse failures and use fallback
  }

  return fallback;
}

function LeadsPipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Incrementing this triggers a full pipeline re-fetch (used after stage mutations).
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Controls the Manage Stages modal.
  const [isManageOpen, setIsManageOpen] = useState(false);

  // The contact currently being dragged — drives the DragOverlay.
  const [activeContact, setActiveContact] = useState<PipelineContact | null>(
    null,
  );

  // Set when a card is dragged to a new column — opens the 2-step transition modal.
  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);

  const [followUpSuggestion, setFollowUpSuggestion] =
    useState<FollowUpSuggestion | null>(null);

  const [isCreatingSuggestedTask, setIsCreatingSuggestedTask] = useState(false);

  // Snapshot of stages before the optimistic move, so Undo can revert it.
  const [stageSnapshot, setStageSnapshot] = useState<PipelineStage[] | null>(
    null,
  );

  // Ensures newly created contacts without a stage are attached to stage 0.
  async function reconcileUnstagedContacts(initialStages: PipelineStage[]) {
    if (initialStages.length === 0) return;

    const firstStage = initialStages[0];
    const stagedContactIds = new Set(
      initialStages.flatMap((stage) =>
        stage.contacts.map((contact) => contact.id),
      ),
    );

    const contactsRes = await fetch(
      `${API_BASE_URL}/api/contacts?page=1&pageSize=100`,
    );
    if (!contactsRes.ok) return;

    const contactsPayload: { items: ContactListItem[] } =
      await contactsRes.json();
    const unstagedContacts = contactsPayload.items.filter(
      (contact) => !stagedContactIds.has(contact.id),
    );
    if (unstagedContacts.length === 0) return;

    const patchResults = await Promise.allSettled(
      unstagedContacts.map(async (contact) => {
        const res = await fetch(
          `${API_BASE_URL}/api/pipeline/${contact.id}/stage`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stageId: firstStage.id }),
          },
        );
        if (!res.ok)
          throw new Error(`Failed to assign ${contact.id} to first stage`);
        return contact;
      }),
    );

    const successfullyAssigned = patchResults
      .filter(
        (result): result is PromiseFulfilledResult<ContactListItem> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    if (successfullyAssigned.length === 0) return;

    setStages((prev) => {
      const existingIds = new Set(
        prev.flatMap((stage) => stage.contacts.map((contact) => contact.id)),
      );

      return prev.map((stage, index) => {
        if (index !== 0) return stage;

        const newContacts = successfullyAssigned
          .filter((contact) => !existingIds.has(contact.id))
          .map((contact) => ({
            id: contact.id,
            fullName: contact.fullName,
            type: contact.type,
            source: contact.source,
            stageId: stage.id,
            openTaskCount: 0,
            lastInteractionAt: null,
          }));

        if (newContacts.length === 0) return stage;
        return {
          ...stage,
          contacts: [...stage.contacts, ...newContacts],
        };
      });
    });
  }

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchPipeline() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/pipeline`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load pipeline (${response.status})`);
        }

        const payload: { stages: PipelineStage[] } = await response.json();
        setStages(payload.stages);

        // Backfills any newly created contacts that do not yet have a stage.
        await reconcileUnstagedContacts(payload.stages);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMessage((err as Error).message || "Failed to load pipeline");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPipeline();

    return () => {
      abortController.abort();
    };
  }, [refreshTrigger]);

  function handleDragStart(event: DragStartEvent) {
    // Store the contact data so the DragOverlay can render it.
    const contact = event.active.data.current?.contact as PipelineContact;
    setActiveContact(contact);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;

    // Dropped outside any column or onto the same column — nothing to do.
    if (!over) return;
    const sourceStageId = active.data.current?.stageId as string;
    const destStageId = over.id as string;
    if (sourceStageId === destStageId) return;

    const contactId = active.id as string;
    const contact = active.data.current?.contact as PipelineContact;
    const sourceStage = stages.find((s) => s.id === sourceStageId);
    const destStage = stages.find((s) => s.id === destStageId);
    if (!sourceStage || !destStage) return;

    // Snapshot current state so Undo can revert to it without an API call.
    setStageSnapshot(stages);

    // Optimistically move the card to the destination column immediately.
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.id === sourceStageId) {
          return {
            ...stage,
            contacts: stage.contacts.filter((c) => c.id !== contactId),
          };
        }
        if (stage.id === destStageId) {
          return {
            ...stage,
            contacts: [...stage.contacts, { ...contact, stageId: destStageId }],
          };
        }
        return stage;
      }),
    );

    // Open the modal. The PATCH only fires once the user confirms through both steps.
    setPendingTransition({
      contactId,
      contactName: contact.fullName,
      fromStageName: sourceStage.name,
      toStageName: destStage.name,
      destStageId,
    });
  }

  // Called when the modal is fully completed. Runs all API side effects once.
  async function handleTransitionComplete(
    payload: TransitionCompletionPayload,
  ) {
    const { contactId, destStageId, interaction, nextSteps } = payload;

    // Collect success messages during API calls, then show them one by one
    // with a delay so toasts appear sequentially instead of in a stack.
    const successMessages: string[] = [];

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/pipeline/${contactId}/stage`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: destStageId }),
        },
      );
      if (!res.ok) {
        const errorMessage = await getApiErrorMessage(
          res,
          "Failed to update stage.",
        );
        toast.error(errorMessage);
        throw new Error(`notified:patch:${res.status}`);
      }
      const responsePayload = await res.json().catch(() => null);
      const suggestion = responsePayload?.followUpSuggestion;
      if (suggestion?.triggered) {
        setFollowUpSuggestion({
          ...(suggestion as Omit<FollowUpSuggestion, "contactId">),
          contactId,
        });
        toast.success("Follow-up suggestion ready.", {
          description:
            suggestion.message ||
            "A suggested follow-up task is available for this stage change.",
        });
      }
      successMessages.push("Stage updated successfully.");

      if (interaction) {
        const interactionRes = await fetch(`${API_BASE_URL}/api/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId,
            type: interaction.type,
            notes: interaction.notes,
          }),
        });
        if (!interactionRes.ok) {
          const errorMessage = await getApiErrorMessage(
            interactionRes,
            "Failed to log interaction.",
          );
          toast.error(errorMessage);
          throw new Error(`notified:interaction:${interactionRes.status}`);
        }
        successMessages.push("Interaction logged successfully.");
      }

      if (nextSteps) {
        for (let index = 0; index < nextSteps.length; index += 1) {
          const nextStep = nextSteps[index];
          const taskRes = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              title: nextStep.title,
              // Backend currently validates description as required.
              description: nextStep.description ?? "-",
              dueAt: nextStep.dueAt,
            }),
          });
          if (!taskRes.ok) {
            const errorMessage = await getApiErrorMessage(
              taskRes,
              `Failed to create next step ${index + 1}.`,
            );
            toast.error(errorMessage);
            throw new Error(`notified:next-step:${taskRes.status}`);
          }
          successMessages.push(`Next step ${index + 1} created successfully.`);
        }
      }

      // Patch the contact's derived fields in local state so the card reflects
      // the newly-created tasks and logged interaction without a full refetch.
      const taskDelta = nextSteps ? nextSteps.length : 0;
      const newLastInteractionAt = interaction
        ? new Date().toISOString()
        : null;

      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          contacts: stage.contacts.map((c) => {
            if (c.id !== contactId) return c;
            return {
              ...c,
              openTaskCount: c.openTaskCount + taskDelta,
              lastInteractionAt: newLastInteractionAt ?? c.lastInteractionAt,
            };
          }),
        })),
      );

      setPendingTransition(null);
      setStageSnapshot(null);

      // Fire success toasts sequentially — each appears after the previous one
      // has had time to animate in, rather than all stacking at once.
      successMessages.forEach((message, index) => {
        setTimeout(() => toast.success(message), index * 650);
      });
    } catch (error) {
      if (stageSnapshot) setStages(stageSnapshot);
      if (error instanceof TypeError) {
        toast.error(
          "Could not reach the API server. Ensure backend is running.",
        );
        throw new Error("transition-failed");
      }
      if (!(error instanceof Error && error.message.startsWith("notified:"))) {
        toast.error(
          "Failed to save the transition. No changes were finalized.",
        );
      }
      throw new Error("transition-failed");
    }
  }

  // Called when the user clicks Undo in the modal.
  // Reverts the optimistic card move and discards the transition entirely.
  function handleTransitionUndo() {
    if (stageSnapshot) setStages(stageSnapshot);
    setPendingTransition(null);
    setStageSnapshot(null);
  }

  async function handleCreateSuggestedTask() {
    if (!followUpSuggestion) {
      return;
    }

    setIsCreatingSuggestedTask(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: followUpSuggestion.contactId,
          title: followUpSuggestion.suggestedTaskTitle,
          description: followUpSuggestion.message,
          dueAt: ymdToDateInputValue(followUpSuggestion.suggestedDueDateYmd),
        }),
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(
          response,
          "Failed to create suggested follow-up task.",
        );
        toast.error(errorMessage);
        return;
      }

      toast.success("Suggested follow-up task created.");
      setFollowUpSuggestion(null);
      setRefreshTrigger((current) => current + 1);
    } finally {
      setIsCreatingSuggestedTask(false);
    }
  }

  function handleDismissSuggestion() {
    setFollowUpSuggestion(null);
  }

  return (
    <section className="page-section space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2>Leads Pipeline</h2>

          {followUpSuggestion && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Follow-up Suggestion</Badge>
                  <Badge variant="outline">
                    Due: {followUpSuggestion.suggestedDueDateYmd}
                  </Badge>
                  <Badge variant="outline">
                    {followUpSuggestion.fromStageName} →{" "}
                    {followUpSuggestion.toStageName}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {followUpSuggestion.suggestedTaskTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {followUpSuggestion.message}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleCreateSuggestedTask}
                    disabled={isCreatingSuggestedTask}
                  >
                    {isCreatingSuggestedTask
                      ? "Creating…"
                      : "Create Suggested Task"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDismissSuggestion}
                    disabled={isCreatingSuggestedTask}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <p className="field-hint">
            Contacts grouped by stage. Drag cards between columns to progress
            leads.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsManageOpen(true)}
        >
          Manage Stages
        </Button>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <PipelineBoard
          stages={stages}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />

        {/* Floating card clone that follows the cursor during drag */}
        <DragOverlay>
          {activeContact ? (
            <Card className="w-64 cursor-grabbing shadow-lg">
              <CardContent className="space-y-2 p-3">
                <p className="text-sm font-medium leading-snug">
                  {activeContact.fullName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      activeContact.type === "CLIENT" ? "default" : "secondary"
                    }
                  >
                    {activeContact.type}
                  </Badge>
                  {activeContact.source ? (
                    <span className="text-xs text-muted-foreground">
                      {activeContact.source}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeContact.openTaskCount > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                      {activeContact.openTaskCount} task
                      {activeContact.openTaskCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                    {daysSinceLabel(activeContact.lastInteractionAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StageTransitionModal
        pendingTransition={pendingTransition}
        onComplete={handleTransitionComplete}
        onUndo={handleTransitionUndo}
      />

      <ManageStagesModal
        open={isManageOpen}
        stages={stages}
        onClose={() => setIsManageOpen(false)}
        onStagesChanged={() => setRefreshTrigger((t) => t + 1)}
      />
    </section>
  );
}

export default LeadsPipelinePage;
