/**
 * Container for the Leads Pipeline page.
 * Owns all state and data fetching; wraps the board in a DndContext for drag-and-drop.
 * On drag end: optimistically moves the card and opens the transition modal.
 * The PATCH to persist the stage change is only called once the user completes or skips
 * both modal steps — not before. Undo in the modal reverts the card with no API call.
 */

import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import PipelineBoard, { type PipelineStage } from "../components/pipeline/PipelineBoard";
import type { PipelineContact } from "../components/pipeline/types";
import StageTransitionModal, {
  type PendingTransition,
} from "../components/pipeline/StageTransitionModal";

function daysSinceLabel(lastInteractionAt: string | null): string {
  if (!lastInteractionAt) return "No contact";
  const days = Math.floor(
    (Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function LeadsPipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // The contact currently being dragged — drives the DragOverlay.
  const [activeContact, setActiveContact] = useState<PipelineContact | null>(null);

  // Set when a card is dragged to a new column — opens the 2-step transition modal.
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);

  // Snapshot of stages before the optimistic move, so Undo can revert it.
  const [stageSnapshot, setStageSnapshot] = useState<PipelineStage[] | null>(null);

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
  }, []);

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
    const destStage = stages.find((s) => s.id === destStageId);
    if (!destStage) return;

    // Snapshot current state so Undo can revert to it without an API call.
    setStageSnapshot(stages);

    // Optimistically move the card to the destination column immediately.
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.id === sourceStageId) {
          return { ...stage, contacts: stage.contacts.filter((c) => c.id !== contactId) };
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
      toStageName: destStage.name,
      destStageId,
    });
  }

  // Called when the user completes or skips both modal steps.
  // This is the point where the stage change is actually persisted.
  async function handleTransitionComplete() {
    if (!pendingTransition) return;
    const { contactId, destStageId } = pendingTransition;

    setPendingTransition(null);
    setStageSnapshot(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/pipeline/${contactId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: destStageId }),
      });
      if (!res.ok) throw new Error(`Failed to update stage (${res.status})`);
    } catch {
      // If the PATCH fails after the modal is closed, revert and notify.
      if (stageSnapshot) setStages(stageSnapshot);
      toast.error("Failed to save stage change. Please try again.");
    }
  }

  // Called when the user clicks Undo in the modal.
  // Reverts the optimistic card move and discards the transition entirely.
  function handleTransitionUndo() {
    if (stageSnapshot) setStages(stageSnapshot);
    setPendingTransition(null);
    setStageSnapshot(null);
  }

  return (
    <section className="page-section space-y-6">
      <div>
        <h2>Leads Pipeline</h2>
        <p className="field-hint">
          Contacts grouped by stage. Drag cards between columns to progress leads.
        </p>
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
                <p className="text-sm font-medium leading-snug">{activeContact.fullName}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={activeContact.type === "CLIENT" ? "default" : "secondary"}>
                    {activeContact.type}
                  </Badge>
                  {activeContact.source ? (
                    <span className="text-xs text-muted-foreground">{activeContact.source}</span>
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
    </section>
  );
}

export default LeadsPipelinePage;
