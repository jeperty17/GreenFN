/**
 * 4-step modal shown after a contact is dragged to a new pipeline stage.
 * Step 0: Confirm stage transition intent (or undo).
 * Step 1: Capture interaction details (or skip with custom warning).
 * Step 2: Capture next-step task details (or skip with custom warning).
 * Step 3: Review summary, then execute all selected API actions.
 * No API calls are made inside this component — parent executes them after completion.
 */

import { AlertTriangle, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import LogInteractionModal from "../interactions/LogInteractionModal";
import type { InteractionFormState } from "../interactions/types";
import { getTodayTaskDateKey } from "../tasks/timezone";
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
    occurredAt: string;
    title: string;
    notes?: string;
    aiSummaryDraft?: string;
    aiSummaryModel?: string | null;
    aiSummarySourceMode?: string | null;
    aiSummaryGeneratedAt?: string | null;
  } | null;
  nextSteps: Array<{
    title: string;
    dueAt: string;
    description?: string;
  }> | null;
}

interface StageTransitionModalProps {
  pendingTransition: PendingTransition | null;
  onComplete: (payload: TransitionCompletionPayload) => Promise<void>;
  onUndo: () => void;
}

interface NextStepDraft {
  id: number;
  title: string;
  dueAt: string;
  description: string;
}

function createEmptyTaskDraft(id: number): NextStepDraft {
  return { id, title: "", dueAt: "", description: "" };
}

function currentDateTimeLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function StageTransitionModal({
  pendingTransition,
  onComplete,
  onUndo,
}: StageTransitionModalProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  // Step 1 fields (reusing the interaction logger modal form state shape).
  const [interactionFormState, setInteractionFormState] =
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
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [isSavingInteractionDraft, setIsSavingInteractionDraft] =
    useState(false);
  const [interactionFormError, setInteractionFormError] = useState("");
  const [shouldCreateInteraction, setShouldCreateInteraction] = useState(true);

  // Step 2 fields
  const [nextStepDrafts, setNextStepDrafts] = useState<NextStepDraft[]>([
    createEmptyTaskDraft(1),
  ]);
  const [nextStepDraftSeed, setNextStepDraftSeed] = useState(2);
  const [shouldCreateNextStep, setShouldCreateNextStep] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Controls the inline skip-confirmation warning on task step.
  const [skipWarning, setSkipWarning] = useState<null | "nextstep">(null);

  function resetLocalState() {
    setStep(0);
    setInteractionFormState({
      type: "CALL",
      interactionDate: currentDateTimeLocal(),
      title: "",
      notes: "",
      aiSummaryDraft: "",
      aiSummaryModel: null,
      aiSummarySourceMode: null,
      aiSummaryGeneratedAt: null,
    });
    setIsInteractionModalOpen(false);
    setIsSavingInteractionDraft(false);
    setInteractionFormError("");
    setShouldCreateInteraction(true);
    setNextStepDrafts([createEmptyTaskDraft(1)]);
    setNextStepDraftSeed(2);
    setShouldCreateNextStep(true);
    setSkipWarning(null);
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
    const todayStr = getTodayTaskDateKey();
    return drafts.every(
      (draft) =>
        draft.title.trim().length > 0 &&
        draft.dueAt.trim().length > 0 &&
        draft.dueAt >= todayStr,
    );
  }

  function isInteractionValid(): boolean {
    return (
      interactionFormState.interactionDate.trim().length > 0 &&
      interactionFormState.title.trim().length > 0 &&
      interactionFormState.notes.trim().length > 0
    );
  }

  async function handleInteractionDraftSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!isInteractionValid()) {
      setInteractionFormError(
        "Type, date and time, interaction title, and notes are required",
      );
      return;
    }

    setInteractionFormError("");
    setIsSavingInteractionDraft(true);
    try {
      setShouldCreateInteraction(true);
      setSkipWarning(null);
      setIsInteractionModalOpen(false);
      setStep(2);
    } finally {
      setIsSavingInteractionDraft(false);
    }
  }

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
            type: interactionFormState.type,
            occurredAt: new Date(
              interactionFormState.interactionDate,
            ).toISOString(),
            title: interactionFormState.title.trim(),
            notes: interactionFormState.notes.trim() || undefined,
            aiSummaryDraft:
              interactionFormState.aiSummaryDraft.trim() || undefined,
            aiSummaryModel: interactionFormState.aiSummaryModel,
            aiSummarySourceMode: interactionFormState.aiSummarySourceMode,
            aiSummaryGeneratedAt: interactionFormState.aiSummaryGeneratedAt,
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

  function goToSummary(options: {
    useInteraction: boolean;
    useNextStep: boolean;
  }) {
    setShouldCreateInteraction(options.useInteraction);
    setShouldCreateNextStep(options.useNextStep);
    setStep(3);
  }

  // Closing via X or Escape = Undo (no API calls made yet).
  return (
    <Dialog
      open={!!pendingTransition}
      onOpenChange={(open) => !open && handleUndo()}
    >
      {step !== 1 && (
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-out hover:bg-[oklch(0.94_0.015_145)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2"
            onClick={handleUndo}
            aria-label="Close"
            disabled={isFinalizing}
          >
            <X className="h-5 w-5" />
          </button>

          {step === 0 ? (
            <>
              <DialogHeader className="space-y-4 pb-1">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/80">
                    Step 1 of 4
                  </p>
                  <DialogTitle className="text-2xl font-semibold leading-tight tracking-tight">
                    Confirm stage transition
                  </DialogTitle>
                  <p className="max-w-[62ch] text-base leading-7 text-muted-foreground">
                    Confirm this move first. Next, you will log an interaction
                    and follow-up tasks
                  </p>
                </div>

                <div className="rounded-lg border border-primary/20 bg-[oklch(0.97_0.014_145)] p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {pendingTransition?.contactName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
                      {pendingTransition?.fromStageName}
                    </span>
                    <span aria-hidden>→</span>
                    <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary">
                      {pendingTransition?.toStageName}
                    </span>
                  </div>
                </div>
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
                <Button
                  onClick={() => {
                    setInteractionFormError("");
                    setInteractionFormState((prev) => ({
                      ...prev,
                      interactionDate:
                        prev.interactionDate || currentDateTimeLocal(),
                      title:
                        prev.title ||
                        `Follow-up after move to ${pendingTransition?.toStageName || "next stage"}`,
                    }));
                    setStep(1);
                    setIsInteractionModalOpen(true);
                  }}
                  disabled={isFinalizing}
                >
                  Continue to interaction
                </Button>
              </DialogFooter>
            </>
          ) : step === 2 ? (
            <>
              <DialogHeader className="space-y-4 border-b border-[oklch(0.88_0.02_145)] bg-[oklch(0.965_0.025_145)] px-6 py-5 -mx-6 -mt-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(0.4_0.1_145)]">
                    Add activity
                  </p>
                  <DialogTitle className="mt-1 text-2xl font-semibold tracking-tight">
                    Add follow-up tasks
                  </DialogTitle>
                    <p className="mt-2 max-w-[60ch] text-base leading-7 text-muted-foreground">
                    Add tasks for{" "}
                    <span className="font-medium text-foreground">
                      {pendingTransition?.contactName}
                    </span>{" "}
                    or skip this step
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTaskDraft}
                  disabled={isFinalizing}
                  className="w-fit"
                >
                  + Add another task
                </Button>
              </DialogHeader>

              <div className="max-h-[28rem] overflow-y-auto py-5 px-1">
                <div className="space-y-4 pr-1 sm:pr-2">
                  {nextStepDrafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="space-y-4 rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] p-4 shadow-[0_10px_28px_-24px_oklch(0.24_0.03_145/0.45)]"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[oklch(0.4_0.1_145)]">
                        Task {index + 1}
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor={`task-title-${draft.id}`}>
                          Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`task-title-${draft.id}`}
                          placeholder="Send policy documents"
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
                          min={getTodayTaskDateKey()}
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
                          placeholder="What needs to be done?"
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

              {skipWarning === "nextstep" && (
                <SkipWarning
                  message="No tasks were added, do you want to skip task creation for this move"
                  onCancel={() => setSkipWarning(null)}
                  onConfirm={() => {
                    setSkipWarning(null);
                    goToSummary({
                      useInteraction: shouldCreateInteraction,
                      useNextStep: false,
                    });
                  }}
                />
              )}

              <DialogFooter className="mt-auto gap-2 border-t border-[oklch(0.88_0.02_145)] pt-5">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSkipWarning(null);
                    setStep(1);
                    setIsInteractionModalOpen(true);
                  }}
                  disabled={isFinalizing}
                >
                  Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSkipWarning("nextstep")}
                  disabled={isFinalizing || skipWarning !== null}
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
                  Review summary
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-4 pb-1">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/80">
                    Step 4 of 4
                  </p>
                  <DialogTitle className="text-2xl font-semibold leading-tight tracking-tight">
                    Review and execute
                  </DialogTitle>
                  <p className="max-w-[62ch] text-base leading-7 text-muted-foreground">
                    Review and confirm your actions when you're ready
                  </p>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                <div className="rounded-lg border border-primary/20 bg-[oklch(0.97_0.014_145)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary/80">
                    Stage change
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {pendingTransition?.contactName}
                    </span>
                    <span className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
                      {pendingTransition?.fromStageName}
                    </span>
                    <span aria-hidden>→</span>
                    <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-medium text-primary">
                      {pendingTransition?.toStageName}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Interaction
                    </p>
                    {shouldCreateInteraction ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        Included
                      </span>
                    ) : null}
                  </div>
                  {shouldCreateInteraction ? (
                    <div className="mt-2 space-y-1.5 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {interactionFormState.type} ·{" "}
                        {interactionFormState.title || "(untitled)"}
                      </p>
                      <p>{interactionFormState.interactionDate || "Date not set"}</p>
                      <p className="line-clamp-2">
                        {interactionFormState.notes || "Notes not added"}
                      </p>
                      {interactionFormState.aiSummaryDraft.trim() && (
                        <p className="text-primary">Includes AI summary draft</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">Not included</p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Next steps
                    </p>
                    {shouldCreateNextStep ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {nextStepDrafts.length} item
                        {nextStepDrafts.length !== 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                  {shouldCreateNextStep ? (
                    <ul className="mt-2 space-y-2 text-muted-foreground">
                      {nextStepDrafts.map((draft, index) => (
                        <li key={draft.id} className="rounded-md border border-border/70 bg-background px-3 py-2">
                          <p className="font-medium text-foreground">
                            {index + 1}. {draft.title || "(untitled)"}
                          </p>
                          <p className="text-xs">
                            Due {draft.dueAt || "—"}
                          </p>
                          {draft.description ? (
                            <p className="mt-1 text-xs line-clamp-2">{draft.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-muted-foreground">Not included</p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (shouldCreateInteraction) {
                      setStep(1);
                      setIsInteractionModalOpen(true);
                      return;
                    }
                    setStep(2);
                  }}
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
                  {isFinalizing ? "Executing actions" : "Execute actions"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      )}

      <LogInteractionModal
        isOpen={isInteractionModalOpen}
        isSavingInteraction={isSavingInteractionDraft}
        isLoadingContacts={false}
        selectedContactId={pendingTransition?.contactId || ""}
        selectedContactName={pendingTransition?.contactName || "this contact"}
        formState={interactionFormState}
        formError={interactionFormError}
        onClose={() => {
          if (!isSavingInteractionDraft) {
            handleUndo();
          }
        }}
        onSubmit={handleInteractionDraftSubmit}
        onSetFormState={setInteractionFormState}
        stepOneBackAction={{
          label: "Back",
          onClick: () => {
            if (isSavingInteractionDraft) return;
            setIsInteractionModalOpen(false);
            setStep(0);
          },
        }}
        stepOneSkipAction={{
          label: "Skip",
          onClick: () => {
            if (isSavingInteractionDraft) return;
            setSkipWarning(null);
            setShouldCreateInteraction(false);
            setIsInteractionModalOpen(false);
            setStep(2);
          },
        }}
      />
    </Dialog>
  );
}

// Inline themed skip-confirmation banner — replaces window.confirm.
function SkipWarning({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-yellow-300/60 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-700/40 dark:bg-yellow-950/30">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1">
        <p className="font-medium text-yellow-800 dark:text-yellow-300">
          Skip this step?
        </p>
        <p className="mt-0.5 text-yellow-700 dark:text-yellow-400">{message}</p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
            onClick={onCancel}
          >
            Don't skip
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600"
            onClick={onConfirm}
          >
            Skip anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StageTransitionModal;
