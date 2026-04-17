import { useEffect, useState } from "react";
import PostInteractionQuestionnaireForm, {
  type FormState,
} from "../components/PostInteractionQuestionnaireForm";
import { API_BASE_URL } from "../config/env";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

type SummaryPreviewState = {
  summaryId: string | null;
  interactionId: string | null;
  interactionLinked: boolean;
  interactionCreated: boolean;
  tasksCreatedCount: number;
  tasksCreated: Array<{
    id: string;
    title: string;
    dueDateYmd: string | null;
  }>;
  generatedSummary: string;
  editableSummary: string;
  sourceMode: FormState["mode"];
  degraded: boolean;
};

type SkipState = {
  sourceMode: FormState["mode"];
  capturedAt: string;
};

function buildSummaryPreviewFromFormData(formData: FormState): string {
  if (formData.mode === "structured") {
    const { keyPoints, clientNeeds, nextSteps, followUpAction } =
      formData.structured;

    return [
      "Client interaction summary:",
      keyPoints.trim(),
      "",
      "Primary needs/concerns:",
      clientNeeds.trim(),
      "",
      "Agreed next steps:",
      nextSteps.trim(),
      followUpAction.trim()
        ? `Advisor follow-up action: ${followUpAction.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (formData.mode === "pasted-summary") {
    return formData.pastedSummary.summary.trim();
  }

  if (formData.mode === "unstructured") {
    return formData.unstructured.notes.trim();
  }

  return [
    `Conversation source: ${formData.chatTranscript.platform}`,
    "",
    formData.chatTranscript.transcript.trim(),
  ].join("\n");
}

function AISummaryPage() {
  const [contacts, setContacts] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [summaryPreview, setSummaryPreview] =
    useState<SummaryPreviewState | null>(null);
  const [skipState, setSkipState] = useState<SkipState | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [skipSuccessMessage, setSkipSuccessMessage] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoadingContacts(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/contacts?page=1&pageSize=50`,
          { signal: abortController.signal },
        );

        if (response.ok) {
          const payload = await response.json();
          const items = payload.items || [];
          setContacts(items);
          setSelectedContactId(items[0]?.id || "");
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load contacts:", error);
        }
      } finally {
        setIsLoadingContacts(false);
      }
    }

    fetchContacts();

    return () => {
      abortController.abort();
    };
  }, []);

  async function handleGenerateSummaryPreview(formData: FormState) {
    if (!selectedContactId) {
      setPreviewError("Please select a contact before generating a summary.");
      return;
    }

    setSkipState(null);
    setSkipSuccessMessage("");
    setSaveSuccessMessage("");
    setIsGeneratingSummary(true);

    try {
      const inputPreview = buildSummaryPreviewFromFormData(formData);
      if (!inputPreview.trim()) {
        throw new Error("Could not build summary input from form data.");
      }

      const requestBody =
        formData.mode === "structured"
          ? {
              contactId: selectedContactId,
              sourceMode: "structured",
              structuredInput: {
                keyPoints: formData.structured.keyPoints,
                clientNeeds: formData.structured.clientNeeds,
                nextSteps: formData.structured.nextSteps,
                followUpAction: formData.structured.followUpAction,
              },
            }
          : {
              contactId: selectedContactId,
              sourceMode: formData.mode,
              input:
                formData.mode === "pasted-summary"
                  ? formData.pastedSummary.summary
                  : formData.mode === "unstructured"
                    ? formData.unstructured.notes
                    : `Platform: ${formData.chatTranscript.platform}\n\n${formData.chatTranscript.transcript}`,
            };

      const response = await fetch(`${API_BASE_URL}/api/ai/summaries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const apiErrorMessage = errorPayload?.error?.message;
        throw new Error(
          apiErrorMessage || `Failed to generate summary (${response.status})`,
        );
      }

      const payload = await response.json();
      const summary = payload?.summary;

      if (!summary?.text) {
        throw new Error("Summary generation returned an empty response.");
      }

      setPreviewError("");
      setSummaryPreview({
        summaryId: summary.id || null,
        interactionId: summary.interactionId || null,
        interactionLinked: Boolean(summary.interactionLinked),
        interactionCreated: Boolean(summary.interactionCreated),
        tasksCreatedCount: Number(summary.tasksCreatedCount || 0),
        tasksCreated: Array.isArray(summary.tasksCreated)
          ? summary.tasksCreated.map(
              (task: {
                id?: unknown;
                title?: unknown;
                dueDateYmd?: unknown;
              }) => ({
                id: typeof task.id === "string" ? task.id : "",
                title:
                  typeof task.title === "string"
                    ? task.title
                    : "Auto-created task",
                dueDateYmd:
                  typeof task.dueDateYmd === "string" ? task.dueDateYmd : null,
              }),
            )
          : [],
        generatedSummary: summary.text,
        editableSummary: summary.text,
        sourceMode: formData.mode,
        degraded: Boolean(summary.degraded),
      });
    } catch (error) {
      setPreviewError(
        (error as Error).message || "Failed to generate summary.",
      );
      setSummaryPreview(null);
    } finally {
      setIsGeneratingSummary(false);
    }
  }

  function handleSkipAiGeneration(formData: FormState) {
    setSummaryPreview(null);
    setPreviewError("");
    setSaveSuccessMessage("");
    setSkipState({
      sourceMode: formData.mode,
      capturedAt: new Date().toISOString(),
    });
    setSkipSuccessMessage(
      "AI generation skipped. You can proceed without a summary or return to generate one.",
    );
  }

  function handleSaveSummaryPreview() {
    if (!summaryPreview || !summaryPreview.editableSummary.trim()) {
      setPreviewError("Summary text cannot be empty before saving.");
      return;
    }

    setPreviewError("");

    if (summaryPreview.summaryId && summaryPreview.interactionLinked) {
      const interactionAction = summaryPreview.interactionCreated
        ? "created"
        : "updated";
      const interactionIdText = summaryPreview.interactionId
        ? ` (ID: ${summaryPreview.interactionId})`
        : "";
      const tasksInfo =
        summaryPreview.tasksCreatedCount > 0
          ? ` Auto-created ${summaryPreview.tasksCreatedCount} task(s): ${summaryPreview.tasksCreated
              .map((task) =>
                task.dueDateYmd
                  ? `${task.title} [${task.dueDateYmd}]`
                  : task.title,
              )
              .join("; ")}.`
          : " No dated follow-up tasks were inferred from this summary.";

      setSaveSuccessMessage(
        `Summary saved (ID: ${summaryPreview.summaryId}) and logged in Interaction History via ${interactionAction} interaction${interactionIdText}.${tasksInfo}`,
      );
      return;
    }

    setSaveSuccessMessage(
      summaryPreview.summaryId
        ? `Summary is saved in database (ID: ${summaryPreview.summaryId}), but no linked interaction was reported.`
        : "Summary generated, but no persisted summary ID was returned.",
    );
  }

  return (
    <section className="page-shell space-y-6">
      <header className="space-y-2">
        <h2>AI Interaction Summaries</h2>
        <p className="text-sm text-muted-foreground">
          Convert your interactions into concise, structured summaries. Choose
          your input method and let AI organize the key details for your
          records.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Select Contact</CardTitle>
          <CardDescription>
            Choose a contact to associate with this interaction summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={isLoadingContacts || contacts.length === 0}
            value={selectedContactId}
            onChange={(event) => setSelectedContactId(event.target.value)}
          >
            {contacts.length === 0 && (
              <option value="">No contacts found</option>
            )}
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.fullName}
              </option>
            ))}
          </select>

          {selectedContactId && (
            <p className="text-sm text-muted-foreground">
              Summarizing interaction for{" "}
              <span className="font-medium">
                {contacts.find((c) => c.id === selectedContactId)?.fullName}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {selectedContactId && !summaryPreview && !skipState && (
        <PostInteractionQuestionnaireForm
          onSubmit={handleGenerateSummaryPreview}
          onSkip={handleSkipAiGeneration}
          isLoading={isGeneratingSummary}
        />
      )}

      {selectedContactId && summaryPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary Preview</CardTitle>
            <CardDescription>
              Review and edit this generated summary before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Source mode: {summaryPreview.sourceMode}
              </Badge>
              <Badge variant="secondary">Editable draft</Badge>
              {summaryPreview.degraded && (
                <Badge variant="outline">Provider fallback used</Badge>
              )}
            </div>

            <div className="field-stack">
              <Label htmlFor="summaryPreview">Generated Summary</Label>
              <Textarea
                id="summaryPreview"
                value={summaryPreview.editableSummary}
                rows={12}
                onChange={(event) =>
                  setSummaryPreview((currentState) =>
                    currentState
                      ? {
                          ...currentState,
                          editableSummary: event.target.value,
                        }
                      : currentState,
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Generated length: {summaryPreview.generatedSummary.length} chars
                {" • "}Current draft length:{" "}
                {summaryPreview.editableSummary.length}
                chars
              </p>
            </div>

            {previewError && (
              <p className="text-sm text-destructive">{previewError}</p>
            )}
            {saveSuccessMessage && (
              <p className="text-sm text-emerald-700">{saveSuccessMessage}</p>
            )}

            <div className="flex gap-3">
              <Button type="button" onClick={handleSaveSummaryPreview}>
                Save Summary
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  handleSkipAiGeneration({
                    mode: summaryPreview.sourceMode,
                    structured: {
                      keyPoints: "",
                      clientNeeds: "",
                      nextSteps: "",
                      followUpAction: "",
                    },
                    pastedSummary: { summary: "" },
                    unstructured: { notes: "" },
                    chatTranscript: { transcript: "", platform: "other" },
                  })
                }
              >
                Skip AI and Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSummaryPreview(null);
                  setPreviewError("");
                  setSaveSuccessMessage("");
                }}
              >
                Back to Questionnaire
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedContactId && skipState && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">AI Generation Skipped</CardTitle>
            <CardDescription>
              You chose to skip AI for this interaction. You can proceed without
              a summary or return to generate one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Source mode: {skipState.sourceMode}
              </Badge>
              <Badge variant="secondary">No AI summary</Badge>
            </div>

            {skipSuccessMessage && (
              <p className="text-sm text-amber-800">{skipSuccessMessage}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Skipped at:{" "}
              {new Date(skipState.capturedAt).toLocaleString("en-SG")}
            </p>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() =>
                  setSkipSuccessMessage(
                    "Interaction recorded without AI summary. Backend persistence will be wired in upcoming API steps.",
                  )
                }
              >
                Proceed Without AI Summary
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSkipState(null);
                  setSkipSuccessMessage("");
                }}
              >
                Generate AI Summary Instead
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">Input Modes Explained</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Structured Fields</Badge>
            </div>
            <p className="mt-2 text-sm">
              Best for: Quick recalls. Fill in bullet points for key discussion
              items, client needs, next steps, and your follow-up action.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Pasted Meeting Summary</Badge>
            </div>
            <p className="mt-2 text-sm">
              Best for: Formal meetings or external summaries. Paste a complete
              summary and AI will extract the key recalls.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Unstructured Notes</Badge>
            </div>
            <p className="mt-2 text-sm">
              Best for: Stream of consciousness. Write freely and AI will
              organize your notes into a structured format.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Chat Transcript</Badge>
            </div>
            <p className="mt-2 text-sm">
              Best for: WhatsApp/email conversations. Paste the full thread and
              AI will summarize the key interaction points and decisions.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default AISummaryPage;
