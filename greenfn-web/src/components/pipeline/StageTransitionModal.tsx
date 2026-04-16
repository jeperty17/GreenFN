/**
 * 4-step modal shown after a contact is dragged to a new pipeline stage.
 * Step 0: Confirm stage transition intent.
 * Step 1: Capture interaction details (or skip).
 * Step 2: Capture next-step task details (or skip).
 * Step 3: Review summary, then execute all selected API actions.
 * No API calls are made inside this component; parent executes PATCH/POST calls
 * only after all steps are completed.
 */

import { useState } from "react";
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
  fromStageName: string;
  toStageName: string;
  destStageId: string;
}

export interface TransitionCompletionPayload {
  contactId: string;
  destStageId: string;
  interaction: {
    type: string;
    notes?: string;
  } | null;
  nextSteps: Array<{
    title: string;
    dueAt: string;
    description?: string;
  }> | null;
}

interface StageTransitionModalProps {
  pendingTransition: PendingTransition | null;
  // Called after all modal steps are completed — parent performs API calls.
  onComplete: (payload: TransitionCompletionPayload) => Promise<void>;
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

interface NextStepDraft {
  id: number;
  title: string;
  dueAt: string;
  description: string;
}

function createEmptyTaskDraft(id: number): NextStepDraft {
  return {
    id,
    title: "",
    dueAt: "",
    description: "",
  };
}

function StageTransitionModal({
  pendingTransition,
  onComplete,
  onUndo,
}: StageTransitionModalProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Step 1 fields
  const [interactionType, setInteractionType] = useState("CALL");
  const [interactionNotes, setInteractionNotes] = useState("");
  const [shouldCreateInteraction, setShouldCreateInteraction] = useState(true);

  // Step 2 fields
  const [nextStepDrafts, setNextStepDrafts] = useState<NextStepDraft[]>([
    createEmptyTaskDraft(1),
  ]);
  const [nextStepDraftSeed, setNextStepDraftSeed] = useState(2);
  const [shouldCreateNextStep, setShouldCreateNextStep] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  function resetLocalState() {
    setStep(0);
    setInteractionType("CALL");
    setInteractionNotes("");
    setShouldCreateInteraction(true);
    setNextStepDrafts([createEmptyTaskDraft(1)]);
    setNextStepDraftSeed(2);
    setShouldCreateNextStep(true);
  }

  function updateTaskDraft(
    id: number,
    field: "title" | "dueAt" | "description",
    value: string,
  ) {
    setNextStepDrafts((prev) =>
      prev.map((draft) =>
        draft.id === id ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function addTaskDraft() {
    setNextStepDrafts((prev) => [
      ...prev,
      createEmptyTaskDraft(nextStepDraftSeed),
    ]);
    setNextStepDraftSeed((prev) => prev + 1);
  }

  function areTaskDraftsValid(drafts: NextStepDraft[]): boolean {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return drafts.every(
      (draft) =>
        draft.title.trim().length > 0 &&
        draft.dueAt.trim().length > 0 &&
        draft.dueAt >= todayStr,
    );
  }

  // Reset local form state, then signal the parent to revert the card.
  function handleUndo() {
    if (isFinalizing) return;
    resetLocalState();
    onUndo();
  }

  async function handleFinalize(options: {
    useInteraction: boolean;
    useNextStep: boolean;
  }) {
    if (!pendingTransition) return;
    if (options.useNextStep && !areTaskDraftsValid(nextStepDrafts)) return;

    const normalizedNextSteps = nextStepDrafts.map((draft) => ({
      title: draft.title.trim(),
      dueAt: draft.dueAt,
      description: draft.description.trim() || undefined,
    }));

    const payload: TransitionCompletionPayload = {
      contactId: pendingTransition.contactId,
      destStageId: pendingTransition.destStageId,
      interaction: options.useInteraction
        ? {
            type: interactionType,
            notes: interactionNotes || undefined,
          }
        : null,
      nextSteps: options.useNextStep ? normalizedNextSteps : null,
    };

    setIsFinalizing(true);
    try {
      await onComplete(payload);
      resetLocalState();
    } finally {
      setIsFinalizing(false);
    }
  }

  function confirmSkip(prompt: string): boolean {
    return window.confirm(prompt);
  }

  function goToSummary(options: {
    useInteraction: boolean;
    useNextStep: boolean;
  }) {
    setShouldCreateInteraction(options.useInteraction);
    setShouldCreateNextStep(options.useNextStep);
    setStep(3);
  }

  // Closing the dialog via the X button or pressing Escape counts as Undo —
  // no API calls have been made yet so the optimistic UI can be reverted safely.
  return (
    <Dialog
      open={!!pendingTransition}
      onOpenChange={(open) => !open && handleUndo()}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        {step === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Stage Transition</DialogTitle>
              <p className="text-sm text-muted-foreground">
                You are moving{" "}
                <span className="font-medium">
                  {pendingTransition?.contactName}
                </span>{" "}
                from{" "}
                <span className="font-medium">
                  {pendingTransition?.fromStageName}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {pendingTransition?.toStageName}
                </span>
                .
              </p>
            </DialogHeader>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleUndo}
                disabled={isFinalizing}
                className="mr-auto"
              >
                Undo move
              </Button>
              <Button onClick={() => setStep(1)} disabled={isFinalizing}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Log Interaction</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Add interaction details for {pendingTransition?.contactName} or
                skip this step.
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
              <Button
                variant="ghost"
                onClick={() => setStep(0)}
                disabled={isFinalizing}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    !confirmSkip(
                      "Are you sure you don't want to log an interaction?",
                    )
                  ) {
                    return;
                  }
                  setShouldCreateInteraction(false);
                  setStep(2);
                }}
                disabled={isFinalizing}
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  setShouldCreateInteraction(true);
                  setStep(2);
                }}
                disabled={isFinalizing}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : step === 2 ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>Set Next Step</DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTaskDraft}
                  disabled={isFinalizing}
                >
                  + Add Task
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Add follow-up task details for{" "}
                <span className="font-medium">
                  {pendingTransition?.contactName}
                </span>{" "}
                or skip this step.
              </p>
            </DialogHeader>

            {/* Scrollable task list — grows up to max-h-64 before the modal
                height is capped; header and footer remain outside this area. */}
            <div className="max-h-[28rem] overflow-y-auto py-2">
              <div className="space-y-4 pr-1">
                {nextStepDrafts.map((draft, index) => (
                  <div
                    key={draft.id}
                    className="space-y-3 rounded-md border border-border p-3"
                  >
                    <p className="text-sm font-medium">Task {index + 1}</p>
                    <div className="space-y-1.5">
                      <Label htmlFor={`task-title-${draft.id}`}>
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`task-title-${draft.id}`}
                        placeholder="e.g. Send policy documents"
                        value={draft.title}
                        onChange={(e) =>
                          updateTaskDraft(draft.id, "title", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`task-due-at-${draft.id}`}>
                        Due date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`task-due-at-${draft.id}`}
                        type="date"
                        min={new Date().toLocaleDateString("en-CA")}
                        value={draft.dueAt}
                        onChange={(e) =>
                          updateTaskDraft(draft.id, "dueAt", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`task-description-${draft.id}`}>
                        Description (optional)
                      </Label>
                      <Textarea
                        id={`task-description-${draft.id}`}
                        placeholder="Any additional notes..."
                        rows={2}
                        value={draft.description}
                        onChange={(e) =>
                          updateTaskDraft(
                            draft.id,
                            "description",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-auto gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isFinalizing}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    !confirmSkip(
                      "Are you sure you don't want to create a next step?",
                    )
                  ) {
                    return;
                  }
                  goToSummary({
                    useInteraction: shouldCreateInteraction,
                    useNextStep: false,
                  });
                }}
                disabled={isFinalizing}
              >
                Skip
              </Button>
              <Button
                onClick={() =>
                  goToSummary({
                    useInteraction: shouldCreateInteraction,
                    useNextStep: true,
                  })
                }
                disabled={isFinalizing || !areTaskDraftsValid(nextStepDrafts)}
              >
                {isFinalizing ? "Saving..." : "Continue"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Review Summary</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Confirm the actions below. API calls will execute only after you
                continue.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="font-medium">Stage change</p>
                <p className="text-muted-foreground">
                  Move {pendingTransition?.contactName} from{" "}
                  {pendingTransition?.fromStageName} to{" "}
                  {pendingTransition?.toStageName}
                </p>
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="font-medium">Interaction</p>
                {shouldCreateInteraction ? (
                  <p className="text-muted-foreground">
                    Create interaction: {interactionType}
                    {interactionNotes ? ` - ${interactionNotes}` : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Skipped</p>
                )}
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="font-medium">Next step</p>
                {shouldCreateNextStep ? (
                  <div className="space-y-1 text-muted-foreground">
                    {nextStepDrafts.map((draft, index) => (
                      <p key={draft.id}>
                        {index + 1}. {draft.title || "(untitled)"} (due{" "}
                        {draft.dueAt || "-"})
                        {draft.description ? ` - ${draft.description}` : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Skipped</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={isFinalizing}
              >
                Back
              </Button>
              <Button
                onClick={() =>
                  handleFinalize({
                    useInteraction: shouldCreateInteraction,
                    useNextStep: shouldCreateNextStep,
                  })
                }
                disabled={isFinalizing}
              >
                {isFinalizing ? "Executing..." : "Execute"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StageTransitionModal;
