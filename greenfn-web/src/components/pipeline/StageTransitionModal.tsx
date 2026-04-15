/**
 * 2-step modal shown after a contact is dragged to a new pipeline stage.
 * Step 1: Log an interaction via POST /api/interactions (skippable).
 * Step 2: Set a next step via POST /api/tasks (skippable).
 * If Step 1's API call fails, the error is toasted and the modal still advances to Step 2.
 * Undo button available on both steps — reverts the card move with no API call.
 */

import { useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/env";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

// The data needed to drive the modal, set when a drag ends.
export interface PendingTransition {
  contactId: string;
  contactName: string;
  toStageName: string;
  destStageId: string; // used by the parent to make the PATCH call on confirm
}

interface StageTransitionModalProps {
  pendingTransition: PendingTransition | null;
  // Called when user completes or skips both steps — triggers the PATCH in the parent.
  onComplete: () => void;
  // Called when user clicks Undo — reverts the card move, no API call.
  onUndo: () => void;
}

// Interaction types shown in the dropdown. WHATSAPP_DM and GENERAL_NOTE are
// omitted — they overlap with WHATSAPP and NOTE respectively.
const INTERACTION_TYPES = [
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "NOTE", label: "Note" },
];

function StageTransitionModal({ pendingTransition, onComplete, onUndo }: StageTransitionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [interactionType, setInteractionType] = useState("CALL");
  const [interactionNotes, setInteractionNotes] = useState("");
  const [isLoggingInteraction, setIsLoggingInteraction] = useState(false);

  // Step 2 fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset local form state, then signal the parent to confirm the stage change.
  function handleComplete() {
    setStep(1);
    setInteractionType("CALL");
    setInteractionNotes("");
    setTaskTitle("");
    setTaskDueAt("");
    setTaskDescription("");
    onComplete();
  }

  // Reset local form state, then signal the parent to revert the card.
  function handleUndo() {
    setStep(1);
    setInteractionType("CALL");
    setInteractionNotes("");
    setTaskTitle("");
    setTaskDueAt("");
    setTaskDescription("");
    onUndo();
  }

  // Step 1 submit — calls POST /api/interactions, then advances to Step 2.
  // On failure, shows a toast but still advances so the user isn't blocked.
  async function handleLogInteraction() {
    if (!pendingTransition) return;
    setIsLoggingInteraction(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: pendingTransition.contactId,
          type: interactionType,
          notes: interactionNotes || undefined,
          // occurredAt omitted — backend defaults to now()
        }),
      });
      if (!res.ok) throw new Error(`Failed to log interaction (${res.status})`);
      toast.success("Interaction logged.");
    } catch {
      toast.error("Could not log interaction — you can add it manually from the contact page.");
    } finally {
      setIsLoggingInteraction(false);
      setStep(2);
    }
  }

  // Step 2 submit — creates a NextStep via POST /api/tasks, then confirms.
  async function handleSetNextStep() {
    if (!pendingTransition || !taskTitle || !taskDueAt) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: pendingTransition.contactId,
          title: taskTitle,
          description: taskDescription,
          dueAt: taskDueAt,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
      toast.success("Next step saved.");
      handleComplete();
    } catch {
      toast.error("Failed to save next step. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Closing the dialog via the X button or pressing Escape counts as Undo —
  // the PATCH hasn't been made yet so there's nothing to commit.
  return (
    <Dialog open={!!pendingTransition} onOpenChange={(open) => !open && handleUndo()}>
      <DialogContent className="sm:max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Log Interaction</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {pendingTransition?.contactName} moved to{" "}
                <span className="font-medium">{pendingTransition?.toStageName}</span>
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="interaction-type">Type</Label>
                <select
                  id="interaction-type"
                  value={interactionType}
                  onChange={(e) => setInteractionType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {INTERACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="interaction-notes">Notes</Label>
                <Textarea
                  id="interaction-notes"
                  placeholder="What happened in this interaction?"
                  rows={3}
                  value={interactionNotes}
                  onChange={(e) => setInteractionNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              {/* Undo is leftmost and clearly distinct — aborts the whole drag */}
              <Button variant="outline" onClick={handleUndo} disabled={isLoggingInteraction} className="mr-auto">
                Undo move
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)} disabled={isLoggingInteraction}>
                Skip
              </Button>
              <Button onClick={handleLogInteraction} disabled={isLoggingInteraction}>
                {isLoggingInteraction ? "Logging..." : "Log & Continue"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Set Next Step</DialogTitle>
              <p className="text-sm text-muted-foreground">
                What needs to happen next for{" "}
                <span className="font-medium">{pendingTransition?.contactName}</span>?
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-title"
                  placeholder="e.g. Send policy documents"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-due-at">
                  Due date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-due-at"
                  type="date"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-description">Description (optional)</Label>
                <Textarea
                  id="task-description"
                  placeholder="Any additional notes..."
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              {/* Undo is leftmost — aborts the whole drag even from Step 2 */}
              <Button variant="outline" onClick={handleUndo} disabled={isSubmitting} className="mr-auto">
                Undo move
              </Button>
              <Button variant="ghost" onClick={handleComplete} disabled={isSubmitting}>
                Skip
              </Button>
              <Button
                onClick={handleSetNextStep}
                disabled={!taskTitle || !taskDueAt || isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Next Step"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StageTransitionModal;