/**
 * Container for the Leads Pipeline page.
 * Header (h1 + count + Manage Stages button) sits outside the board container,
 * matching the Contacts Hub layout pattern.
 * The board container fills remaining viewport height and scrolls both horizontally
 * (many stages) and vertically (many cards in a stage).
 * On drag end: optimistically moves the card and opens the transition modal.
 * The PATCH to persist the stage change is only called once the user completes or
 * skips both modal steps — not before. Undo in the modal reverts the card with
 * a shrink-fade exit animation before the state is reverted.
 */

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import LogInteractionModal from "../components/interactions/LogInteractionModal";
import type { InteractionFormState } from "../components/interactions/types";
import PendingTransitionActionsBanner from "../components/pipeline/PendingTransitionActionsBanner";
import PendingTransitionActionsDialog, {
  type PendingTransitionActionItem,
} from "../components/pipeline/PendingTransitionActionsDialog";
import PipelineBoard, {
  type PipelineStage,
} from "../components/pipeline/PipelineBoard";
import type { PipelineContact } from "../components/pipeline/types";
import StageTransitionModal, {
  type PendingTransition,
  type TransitionCompletionPayload,
} from "../components/pipeline/StageTransitionModal";
import ManageStagesModal from "../components/pipeline/ManageStagesModal";
import AddTaskModal from "../components/tasks/AddTaskModal";
import { CheckSquare, Clock } from "lucide-react";

interface ContactListItem {
  id: string;
  fullName: string;
  type: "LEAD" | "CLIENT";
  source: string | null;
}

interface UnresolvedPayload {
  unresolvedInteractions: PendingTransitionActionItem[];
  unresolvedTasks: PendingTransitionActionItem[];
}

function currentDateTimeLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function isoToDateInputValue(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToDatetimeLocalValue(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return currentDateTimeLocal();
  parsed.setMinutes(parsed.getMinutes() - parsed.getTimezoneOffset());
  return parsed.toISOString().slice(0, 16);
}

function formatDateTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
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
  } catch {
    // ignore parse failures and use fallback
  }
  return fallback;
}

function LeadsPipelinePage() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<PipelineContact | null>(
    null,
  );
  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);
  const [stageSnapshot, setStageSnapshot] = useState<PipelineStage[] | null>(
    null,
  );
  const [unresolvedInteractions, setUnresolvedInteractions] = useState<
    PendingTransitionActionItem[]
  >([]);
  const [unresolvedTasks, setUnresolvedTasks] = useState<
    PendingTransitionActionItem[]
  >([]);
  const [isOutstandingOpen, setIsOutstandingOpen] = useState(false);
  const [resolveTaskTarget, setResolveTaskTarget] =
    useState<PendingTransitionActionItem | null>(null);
  const [resolveInteractionTarget, setResolveInteractionTarget] =
    useState<PendingTransitionActionItem | null>(null);
  const [isSavingResolveInteraction, setIsSavingResolveInteraction] =
    useState(false);
  const [resolveInteractionError, setResolveInteractionError] = useState("");
  const [resolveInteractionFormState, setResolveInteractionFormState] =
    useState<InteractionFormState>({
      type: "CALL",
      interactionDate: currentDateTimeLocal(),
      title: "",
      notes: "",
      aiSummaryDraft: "",
      aiSummaryModel: null,
      aiSummarySourceMode: null,
      aiSummaryGeneratedAt: null,
    });

  // contactId of the card currently playing the shrink-fade undo exit animation.
  const [undoingContactId, setUndoingContactId] = useState<string | null>(null);

  async function reconcileUnstagedContacts(initialStages: PipelineStage[]) {
    if (initialStages.length === 0) return;

    const firstStage = initialStages[0];
    const stagedContactIds = new Set(
      initialStages.flatMap((stage) => stage.contacts.map((c) => c.id)),
    );

    const contactsRes = await fetch(
      `${API_BASE_URL}/api/contacts?page=1&pageSize=100`,
    );
    if (!contactsRes.ok) return;

    const contactsPayload: { items: ContactListItem[] } =
      await contactsRes.json();
    const unstagedContacts = contactsPayload.items.filter(
      (c) => !stagedContactIds.has(c.id),
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
        prev.flatMap((stage) => stage.contacts.map((c) => c.id)),
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
            email: null,
            phone: null,
            isStarred: false,
            tags: [],
            openTaskCount: 0,
            lastInteractionAt: null,
            interactionCount: 0,
            policyCount: 0,
          }));

        if (newContacts.length === 0) return stage;
        return { ...stage, contacts: [...stage.contacts, ...newContacts] };
      });
    });
  }

  async function fetchUnresolved(signal: AbortSignal) {
    const response = await fetch(`${API_BASE_URL}/api/pipeline/unresolved`, {
      signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to load unresolved actions (${response.status})`);
    }

    const payload: UnresolvedPayload = await response.json();
    setUnresolvedInteractions(payload.unresolvedInteractions || []);
    setUnresolvedTasks(payload.unresolvedTasks || []);
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
        await reconcileUnstagedContacts(payload.stages);

        try {
          await fetchUnresolved(abortController.signal);
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            setUnresolvedInteractions([]);
            setUnresolvedTasks([]);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMessage((err as Error).message || "Failed to load pipeline");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPipeline();
    return () => abortController.abort();
  }, [refreshTrigger]);

  function handleDragStart(event: DragStartEvent) {
    const contact = event.active.data.current?.contact as PipelineContact;
    setActiveContact(contact);
  }

  function handleResolveInteraction(item: PendingTransitionActionItem) {
    setResolveInteractionError("");
    setResolveInteractionTarget(item);
    setIsOutstandingOpen(false);
    setResolveInteractionFormState({
      type: "CALL",
      interactionDate: isoToDatetimeLocalValue(item.stageUpdatedAt),
      title: item.stageName
        ? `Follow-up after move to ${item.stageName}`
        : "Follow-up after stage transition",
      notes: "",
      aiSummaryDraft: "",
      aiSummaryModel: null,
      aiSummarySourceMode: null,
      aiSummaryGeneratedAt: null,
    });
  }

  async function handleResolveInteractionSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!resolveInteractionTarget) {
      setResolveInteractionError("No unresolved interaction selected");
      return;
    }
    if (!resolveInteractionFormState.interactionDate) {
      setResolveInteractionError("Interaction date is required");
      return;
    }
    if (!resolveInteractionFormState.title.trim()) {
      setResolveInteractionError("Interaction title is required");
      return;
    }
    if (!resolveInteractionFormState.notes.trim()) {
      setResolveInteractionError("Notes are required");
      return;
    }

    setResolveInteractionError("");
    setIsSavingResolveInteraction(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: resolveInteractionTarget.id,
          type: resolveInteractionFormState.type,
          occurredAt: new Date(
            resolveInteractionFormState.interactionDate,
          ).toISOString(),
          title: resolveInteractionFormState.title.trim(),
          notes: resolveInteractionFormState.notes.trim(),
        }),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          "Failed to log interaction",
        );
        setResolveInteractionError(message);
        return;
      }

      toast.success("Interaction logged, unresolved item cleared");
      setResolveInteractionTarget(null);
      setRefreshTrigger((t) => t + 1);
    } catch (error) {
      if (error instanceof TypeError) {
        setResolveInteractionError(
          "Could not reach the API server, ensure backend is running",
        );
      } else {
        setResolveInteractionError("Failed to log interaction");
      }
    } finally {
      setIsSavingResolveInteraction(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const sourceStageId = active.data.current?.stageId as string;
    const destStageId = over.id as string;
    if (sourceStageId === destStageId) return;

    const contactId = active.id as string;
    const contact = active.data.current?.contact as PipelineContact;
    const sourceStage = stages.find((s) => s.id === sourceStageId);
    const destStage = stages.find((s) => s.id === destStageId);
    if (!sourceStage || !destStage) return;

    setStageSnapshot(stages);

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

    setPendingTransition({
      contactId,
      contactName: contact.fullName,
      fromStageName: sourceStage.name,
      toStageName: destStage.name,
      destStageId,
    });
  }

  async function handleTransitionComplete(
    payload: TransitionCompletionPayload,
  ) {
    const { contactId, destStageId, interaction, nextSteps } = payload;
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
        const msg = await getApiErrorMessage(res, "Failed to update stage");
        toast.error(msg);
        throw new Error(`notified:patch:${res.status}`);
      }
      await res.json().catch(() => null);
      successMessages.push("Stage updated successfully");

      if (interaction) {
        const interactionRes = await fetch(`${API_BASE_URL}/api/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId,
            type: interaction.type,
            occurredAt: interaction.occurredAt,
            title: interaction.title,
            notes: interaction.notes,
          }),
        });
        if (!interactionRes.ok) {
          const msg = await getApiErrorMessage(
            interactionRes,
            "Failed to log interaction",
          );
          toast.error(msg);
          throw new Error(`notified:interaction:${interactionRes.status}`);
        }

        const interactionPayload = await interactionRes
          .json()
          .catch(() => null);
        const createdInteractionId =
          typeof interactionPayload?.item?.id === "string"
            ? interactionPayload.item.id
            : "";

        if (interaction.aiSummaryDraft?.trim() && createdInteractionId) {
          const summaryLinkRes = await fetch(
            `${API_BASE_URL}/api/interactions/${encodeURIComponent(createdInteractionId)}/summary-link`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summaryText: interaction.aiSummaryDraft.trim(),
                model: interaction.aiSummaryModel,
                sourceMode: interaction.aiSummarySourceMode || "notes",
                generatedAt:
                  interaction.aiSummaryGeneratedAt || new Date().toISOString(),
              }),
            },
          );

          if (!summaryLinkRes.ok) {
            const msg = await getApiErrorMessage(
              summaryLinkRes,
              "Interaction saved, AI summary could not be attached",
            );
            toast.error(msg);
            throw new Error(
              `notified:interaction-summary-link:${summaryLinkRes.status}`,
            );
          }
        }

        successMessages.push("Interaction logged successfully");
      }

      if (nextSteps) {
        for (let i = 0; i < nextSteps.length; i++) {
          const nextStep = nextSteps[i];
          const taskRes = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              title: nextStep.title,
              description: nextStep.description ?? "-",
              dueAt: nextStep.dueAt,
            }),
          });
          if (!taskRes.ok) {
            const msg = await getApiErrorMessage(
              taskRes,
              `Failed to create task ${i + 1}`,
            );
            toast.error(msg);
            throw new Error(`notified:next-step:${taskRes.status}`);
          }
          successMessages.push(`Task ${i + 1} created successfully`);
        }
      }

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

      successMessages.forEach((message, index) => {
        setTimeout(() => toast.success(message), index * 650);
      });

      // Refresh pipeline + unresolved counts so banners reflect the latest transition outcome.
      setRefreshTrigger((t) => t + 1);
    } catch (error) {
      if (stageSnapshot) setStages(stageSnapshot);
      if (error instanceof TypeError) {
        toast.error(
          "Could not reach the API server, ensure backend is running",
        );
        throw new Error("transition-failed");
      }
      if (!(error instanceof Error && error.message.startsWith("notified:"))) {
        toast.error(
          "Failed to save the transition, no changes were finalized",
        );
      }
      throw new Error("transition-failed");
    }
  }

  // Plays a shrink-fade animation on the card in the destination column,
  // then reverts the optimistic stage move after the animation completes.
  function handleTransitionUndo() {
    if (!pendingTransition) return;

    setUndoingContactId(pendingTransition.contactId);
    setPendingTransition(null);

    setTimeout(() => {
      if (stageSnapshot) setStages(stageSnapshot);
      setStageSnapshot(null);
      setUndoingContactId(null);
    }, 350);
  }

  const hasOutstandingActions =
    unresolvedInteractions.length > 0 || unresolvedTasks.length > 0;
  const totalContacts = stages.reduce(
    (sum, stage) => sum + stage.contacts.length,
    0,
  );
  const showEmptyPipelinePrompt =
    !isLoading && !errorMessage && totalContacts === 0;

  return (
    // flex-col fills the viewport height minus main's py-6 padding (48px = 3rem)
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-5">
      {/* ── Header — outside the board container, matching Contacts Hub pattern ── */}
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black">
            Leads Pipeline
          </h1>
          <p className="max-w-[65ch] text-base leading-7 text-muted-foreground">
            Move contacts across stages, then finish pending interactions and
            tasks
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

      {hasOutstandingActions && (
        <PendingTransitionActionsBanner
          unresolvedTaskCount={unresolvedTasks.length}
          unresolvedInteractionCount={unresolvedInteractions.length}
          onReviewActions={() => setIsOutstandingOpen(true)}
        />
      )}

      {/* ── Board container — fills remaining height, scrolls both axes ── */}
      <div
        className="min-h-0 flex-1 overflow-auto rounded-2xl border border-primary/15 bg-card px-4 py-5"
        style={{
          backgroundImage:
            "linear-gradient(170deg, oklch(0.99 0.006 145) 0%, oklch(0.975 0.012 145) 100%)",
        }}
      >
        {showEmptyPipelinePrompt ? (
          <Card className="mx-auto mt-8 max-w-xl border-primary/20 bg-[oklch(0.985_0.008_145)] shadow-sm">
            <CardContent className="space-y-3 p-6 text-center">
              <p className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                Your pipeline is empty
              </p>
              <p className="mx-auto max-w-[55ch] text-base leading-7 text-muted-foreground">
                Add your first contact in Contacts Hub to start filling this
                pipeline
              </p>
              <Button
                type="button"
                onClick={() => navigate("/?open=add-contact")}
              >
                Add Contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <PipelineBoard
              stages={stages}
              isLoading={isLoading}
              errorMessage={errorMessage}
              undoingContactId={undoingContactId}
            />

            {/* Floating card clone that follows the cursor during drag */}
            <DragOverlay>
              {activeContact ? (
                <Card className="w-64 cursor-grabbing border-primary/25 bg-[oklch(0.99_0.006_145)] shadow-lg">
                  <CardContent className="space-y-2 p-3">
                    <p className="text-base font-semibold leading-tight tracking-tight">
                      {activeContact.fullName}
                    </p>
                    <div>
                      <Badge
                        variant={
                          activeContact.type === "CLIENT"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {activeContact.type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                        <CheckSquare className="h-3 w-3" />
                        {activeContact.openTaskCount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {daysSinceLabel(activeContact.lastInteractionAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

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

      <PendingTransitionActionsDialog
        open={isOutstandingOpen}
        onOpenChange={setIsOutstandingOpen}
        unresolvedTasks={unresolvedTasks}
        unresolvedInteractions={unresolvedInteractions}
        formatDateTimeLabel={formatDateTimeLabel}
        onCreateTask={(item) => {
          setResolveTaskTarget(item);
          setIsOutstandingOpen(false);
        }}
        onLogInteraction={(item) => {
          handleResolveInteraction(item);
        }}
      />

      <AddTaskModal
        isOpen={Boolean(resolveTaskTarget)}
        onClose={() => setResolveTaskTarget(null)}
        onSuccess={() => {
          toast.success("Task created, unresolved item cleared");
          setResolveTaskTarget(null);
          setRefreshTrigger((t) => t + 1);
        }}
        initialContactId={resolveTaskTarget?.id}
        initialContactName={resolveTaskTarget?.fullName}
        lockContactSelection
        initialDueAt={
          resolveTaskTarget
            ? isoToDateInputValue(resolveTaskTarget.stageUpdatedAt)
            : undefined
        }
        allowPastDueDate
      />

      <LogInteractionModal
        isOpen={Boolean(resolveInteractionTarget)}
        isSavingInteraction={isSavingResolveInteraction}
        isLoadingContacts={false}
        selectedContactId={resolveInteractionTarget?.id || ""}
        selectedContactName={
          resolveInteractionTarget?.fullName || "this contact"
        }
        formState={resolveInteractionFormState}
        formError={resolveInteractionError}
        onClose={() => {
          if (!isSavingResolveInteraction) {
            setResolveInteractionTarget(null);
            setResolveInteractionError("");
          }
        }}
        onSubmit={handleResolveInteractionSubmit}
        onSetFormState={setResolveInteractionFormState}
      />
    </div>
  );
}

export default LeadsPipelinePage;
