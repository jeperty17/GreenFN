/*
 * LogInteractionModal provides a reusable modal form for creating interaction
 * entries while keeping the page itself focused on orchestration/state.
 */

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/env";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type { InteractionFormState, InteractionType } from "./types";

interface LogInteractionModalProps {
  isOpen: boolean;
  isSavingInteraction: boolean;
  isLoadingContacts: boolean;
  selectedContactId: string;
  selectedContactName: string;
  formState: InteractionFormState;
  formError: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSetFormState: (
    updater: (prev: InteractionFormState) => InteractionFormState,
  ) => void;
}

function getFriendlySummaryErrorMessage(responseStatus: number): string {
  if (responseStatus === 400) {
    return "Please check the summary input and try again.";
  }

  if (responseStatus === 401 || responseStatus === 403) {
    return "You are not allowed to generate a summary right now.";
  }

  if (responseStatus === 404) {
    return "The selected contact or record could not be found.";
  }

  if (responseStatus === 413) {
    return "The input is too long. Please shorten it and try again.";
  }

  if (responseStatus === 422) {
    return "The input was blocked by a safety check. Please revise it and try again.";
  }

  if (responseStatus === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (responseStatus >= 500) {
    return "AI summary generation is temporarily unavailable. Please try again later.";
  }

  return "Failed to generate summary. Please try again.";
}

function LogInteractionModal({
  isOpen,
  isSavingInteraction,
  isLoadingContacts,
  selectedContactId,
  selectedContactName,
  formState,
  formError,
  onClose,
  onSubmit,
  onSetFormState,
}: LogInteractionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [originalNotesSnapshot, setOriginalNotesSnapshot] = useState("");
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [contentBounds, setContentBounds] = useState({ left: 0, right: 0 });

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setIsGeneratingSummary(false);
    setOriginalNotesSnapshot("");
    setIsComparingOriginal(false);
  }, [isOpen]);

  useEffect(() => {
    const mainElement = document.querySelector("main");

    function updateContentBounds() {
      if (!mainElement) {
        setContentBounds({ left: 0, right: 0 });
        return;
      }

      const rect = mainElement.getBoundingClientRect();
      setContentBounds({
        left: Math.max(0, rect.left),
        right: Math.max(0, window.innerWidth - rect.right),
      });
    }

    const resizeObserver = mainElement
      ? new ResizeObserver(updateContentBounds)
      : null;

    if (mainElement && resizeObserver) {
      resizeObserver.observe(mainElement);
    }

    updateContentBounds();
    window.addEventListener("resize", updateContentBounds);

    return () => {
      window.removeEventListener("resize", updateContentBounds);
      resizeObserver?.disconnect();
    };
  }, []);

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!isOpen || !portalTarget) return null;

  async function handleGenerateSummaryPreview() {
    const trimmedNotes = formState.notes.trim();
    const trimmedTitle = formState.title.trim();

    if (!selectedContactId) {
      toast.error("Please select a contact first");
      return;
    }

    if (!trimmedTitle) {
      toast.error("Please add a one-line interaction title first");
      return;
    }

    if (!trimmedNotes) {
      toast.error("Please add notes before generating AI summary");
      return;
    }

    setIsGeneratingSummary(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/summaries/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: selectedContactId,
          sourceMode: "notes",
          input: `Interaction title: ${trimmedTitle}\n\nInteraction notes:\n${trimmedNotes}`,
        }),
      });

      if (!response.ok) {
        throw new Error(getFriendlySummaryErrorMessage(response.status));
      }

      const payload = await response.json();
      const summary = payload?.summary;

      if (!summary?.text || typeof summary.text !== "string") {
        throw new Error("Gemini returned an empty summary");
      }

      if (!originalNotesSnapshot.trim()) {
        setOriginalNotesSnapshot(formState.notes);
      }

      onSetFormState((currentState) => ({
        ...currentState,
        notes: summary.text,
        aiSummaryDraft: summary.text,
        aiSummaryModel:
          typeof summary.model === "string" ? summary.model : "gemini",
        aiSummarySourceMode:
          typeof summary.sourceMode === "string" ? summary.sourceMode : "notes",
        aiSummaryGeneratedAt:
          typeof summary.generatedAt === "string"
            ? summary.generatedAt
            : new Date().toISOString(),
      }));

      setIsComparingOriginal(false);

      toast.success("AI summary generated successfully");
    } catch (error) {
      toast.error(
        (error as Error).message ||
          "AI summary generation is temporarily unavailable. Please try again later.",
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[oklch(0.18_0.01_145/0.45)]"
        onClick={onClose}
      />

      <div
        className="absolute inset-y-0 flex items-center justify-center p-4"
        style={{ left: contentBounds.left, right: contentBounds.right }}
      >
        <div className="flex max-h-[88dvh] w-full min-w-0 max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] shadow-[0_14px_36px_-24px_oklch(0.24_0.03_145/0.45)]">
          <div className="flex items-center justify-between rounded-t-2xl border-b border-[oklch(0.88_0.02_145)] bg-[oklch(0.965_0.025_145)] px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(0.4_0.1_145)]">
                Add activity · Step {step} of 2
              </p>
              <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">
                Log Interaction
              </h3>
              <p className="mt-2 max-w-[60ch] text-base leading-7 text-muted-foreground">
                Record a new interaction for {selectedContactName}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-out hover:bg-[oklch(0.94_0.015_145)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form
            className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
            onSubmit={onSubmit}
          >
            {step === 1 ? (
              <>
                <div className="form-grid">
                  <div className="field-stack">
                    <Label htmlFor="interactionType">Type</Label>
                    <select
                      id="interactionType"
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      value={formState.type}
                      onChange={(event) =>
                        onSetFormState((currentState) => ({
                          ...currentState,
                          type: event.target.value as InteractionType,
                        }))
                      }
                    >
                      <option value="CALL">Call</option>
                      <option value="MEETING">Meeting</option>
                      <option value="WHATSAPP_DM">WhatsApp/DM</option>
                    </select>
                  </div>

                  <div className="field-stack">
                    <Label htmlFor="interactionDate">Date & time</Label>
                    <input
                      id="interactionDate"
                      className="w-full rounded-md border bg-background px-3 py-2 text-base"
                      type="datetime-local"
                      value={formState.interactionDate}
                      onChange={(event) =>
                        onSetFormState((currentState) => ({
                          ...currentState,
                          interactionDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field-stack">
                  <Label htmlFor="interactionTitle">Interaction title</Label>
                  <input
                    id="interactionTitle"
                    className="w-full rounded-md border bg-background px-3 py-2 text-base"
                    type="text"
                    placeholder="One-line summary of this interaction"
                    value={formState.title}
                    onChange={(event) =>
                      onSetFormState((currentState) => ({
                        ...currentState,
                        title: event.target.value,
                      }))
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Summarise your interaction in one line
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="field-stack">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="interactionNotes">Your notes</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {originalNotesSnapshot.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setIsComparingOriginal(
                              (currentState) => !currentState,
                            )
                          }
                          disabled={isGeneratingSummary || isSavingInteraction}
                        >
                          {isComparingOriginal
                            ? "Back to AI"
                            : "Compare original"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleGenerateSummaryPreview()}
                        disabled={
                          isGeneratingSummary ||
                          isSavingInteraction ||
                          isComparingOriginal
                        }
                        className="inline-flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isGeneratingSummary
                          ? "Summarising"
                          : "Use AI to summarise"}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="interactionNotes"
                    placeholder={
                      isComparingOriginal
                        ? "Original notes before AI summary"
                        : "Paste meeting notes from your note or voice app, or type free-form unstructured notes"
                    }
                    value={
                      isComparingOriginal
                        ? originalNotesSnapshot
                        : formState.notes
                    }
                    className="min-h-[34dvh] resize-y"
                    rows={14}
                    readOnly={isComparingOriginal}
                    onChange={(event) =>
                      onSetFormState((currentState) => {
                        const nextNotes = event.target.value;
                        const hasAiDraft =
                          currentState.aiSummaryDraft.trim().length > 0 ||
                          Boolean(currentState.aiSummaryGeneratedAt);

                        return {
                          ...currentState,
                          notes: nextNotes,
                          aiSummaryDraft: hasAiDraft
                            ? nextNotes
                            : currentState.aiSummaryDraft,
                        };
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    {isComparingOriginal
                      ? "View your original notes for reference and switch back to AI to continue editing what will be saved"
                      : "This can be a polished meeting summary, voice transcript, chat log, or unstructured notes Use AI to help summarise and refine your interaction notes"}
                  </p>
                </div>
              </>
            )}

            {formError && (
              <p className="text-base leading-7 text-destructive">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSavingInteraction}
              >
                Cancel
              </Button>
              {step === 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={
                    isSavingInteraction ||
                    !formState.title.trim() ||
                    !formState.interactionDate
                  }
                >
                  Next
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isSavingInteraction || isGeneratingSummary}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isLoadingContacts ||
                      isSavingInteraction ||
                      !selectedContactId ||
                      !formState.notes.trim() ||
                      !formState.title.trim()
                    }
                  >
                    {isSavingInteraction ? "Saving" : "Save interaction"}
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalTarget);
}

export default LogInteractionModal;
