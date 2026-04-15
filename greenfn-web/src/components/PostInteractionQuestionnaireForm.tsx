import { type FormEvent, useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type InputMode =
  | "structured"
  | "pasted-summary"
  | "unstructured"
  | "chat-transcript";

type StructuredFieldsState = {
  keyPoints: string;
  clientNeeds: string;
  nextSteps: string;
  followUpAction: string;
};

type PastedSummaryState = {
  summary: string;
};

type UnstructuredState = {
  notes: string;
};

type ChatTranscriptState = {
  transcript: string;
  platform: string;
};

type FormState = {
  mode: InputMode;
  structured: StructuredFieldsState;
  pastedSummary: PastedSummaryState;
  unstructured: UnstructuredState;
  chatTranscript: ChatTranscriptState;
};

type Props = {
  onSubmit?: (data: FormState) => void;
  isLoading?: boolean;
};

function PostInteractionQuestionnaireForm({ onSubmit, isLoading }: Props) {
  const [formState, setFormState] = useState<FormState>({
    mode: "structured",
    structured: {
      keyPoints: "",
      clientNeeds: "",
      nextSteps: "",
      followUpAction: "",
    },
    pastedSummary: {
      summary: "",
    },
    unstructured: {
      notes: "",
    },
    chatTranscript: {
      transcript: "",
      platform: "whatsapp",
    },
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function validateFormState(): boolean {
    const { mode } = formState;

    switch (mode) {
      case "structured": {
        const { keyPoints, clientNeeds, nextSteps } = formState.structured;
        if (!keyPoints.trim() || !clientNeeds.trim() || !nextSteps.trim()) {
          setError("All structured fields are required.");
          return false;
        }
        break;
      }
      case "pasted-summary": {
        if (!formState.pastedSummary.summary.trim()) {
          setError("Please paste a meeting summary.");
          return false;
        }
        break;
      }
      case "unstructured": {
        if (!formState.unstructured.notes.trim()) {
          setError("Please enter your notes.");
          return false;
        }
        break;
      }
      case "chat-transcript": {
        if (!formState.chatTranscript.transcript.trim()) {
          setError("Please paste the chat transcript.");
          return false;
        }
        break;
      }
    }

    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validateFormState()) {
      return;
    }

    if (onSubmit) {
      onSubmit(formState);
    }

    setSuccess(
      "Questionnaire submitted. Processing for AI summary generation...",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Post-Interaction Questionnaire
        </CardTitle>
        <CardDescription>
          Choose how you'd like to provide information about this interaction.
          The AI will generate a concise summary for your records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input Mode Selector */}
          <div className="space-y-3">
            <Label>How would you like to input this interaction?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "structured" as const,
                    label: "Structured Fields",
                    description: "Fill in key points manually",
                  },
                  {
                    value: "pasted-summary" as const,
                    label: "Pasted Meeting Summary",
                    description: "Paste a meeting summary directly",
                  },
                  {
                    value: "unstructured" as const,
                    label: "Unstructured Notes",
                    description: "Free-form notes",
                  },
                  {
                    value: "chat-transcript" as const,
                    label: "Chat Transcript",
                    description: "Paste a chat conversation",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    formState.mode === option.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    setFormState((prev) => ({ ...prev, mode: option.value }))
                  }
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Structured Fields Mode */}
          {formState.mode === "structured" && (
            <div className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="keyPoints">
                  Key Points Discussed
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="keyPoints"
                  placeholder="e.g., Discussed insurance gaps, client concerned about premium costs, reviewed coverage limits..."
                  value={formState.structured.keyPoints}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      structured: {
                        ...prev.structured,
                        keyPoints: e.target.value,
                      },
                    }))
                  }
                  rows={4}
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="clientNeeds">
                  Client Needs / Concerns
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="clientNeeds"
                  placeholder="e.g., Needs flexible payment plan, wants better education coverage, concerned about application process..."
                  value={formState.structured.clientNeeds}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      structured: {
                        ...prev.structured,
                        clientNeeds: e.target.value,
                      },
                    }))
                  }
                  rows={4}
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="nextSteps">
                  Next Steps Agreed
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="nextSteps"
                  placeholder="e.g., Send product options, schedule follow-up Monday, prepare quote with family riders..."
                  value={formState.structured.nextSteps}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      structured: {
                        ...prev.structured,
                        nextSteps: e.target.value,
                      },
                    }))
                  }
                  rows={4}
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="followUpAction">
                  Your Follow-Up Action Required
                </Label>
                <Input
                  id="followUpAction"
                  placeholder="e.g., Send 3 product brochures by Friday"
                  value={formState.structured.followUpAction}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      structured: {
                        ...prev.structured,
                        followUpAction: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Pasted Summary Mode */}
          {formState.mode === "pasted-summary" && (
            <div className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="pastedSummary">
                  Meeting Summary
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="pastedSummary"
                  placeholder="Paste your meeting summary here. Include key points, decisions made, and agreed next steps..."
                  value={formState.pastedSummary.summary}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      pastedSummary: { summary: e.target.value },
                    }))
                  }
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Typically 2-5 paragraphs describing the interaction and
                  outcomes.
                </p>
              </div>
            </div>
          )}

          {/* Unstructured Notes Mode */}
          {formState.mode === "unstructured" && (
            <div className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="unstructuredNotes">
                  Your Notes
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="unstructuredNotes"
                  placeholder="Write freely about the interaction. Include what was discussed, important details, client sentiment, and any decisions made..."
                  value={formState.unstructured.notes}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      unstructured: { notes: e.target.value },
                    }))
                  }
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  No need for structure—just capture what you remember. AI will
                  organize it.
                </p>
              </div>
            </div>
          )}

          {/* Chat Transcript Mode */}
          {formState.mode === "chat-transcript" && (
            <div className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="platform">Chat Platform</Label>
                <select
                  id="platform"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formState.chatTranscript.platform}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      chatTranscript: {
                        ...prev.chatTranscript,
                        platform: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="other">Other Chat Platform</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="transcript">
                  Chat Transcript
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="transcript"
                  placeholder="Paste the full chat conversation here. Include sender labels like 'You:' or 'Client:' for clarity..."
                  value={formState.chatTranscript.transcript}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      chatTranscript: {
                        ...prev.chatTranscript,
                        transcript: e.target.value,
                      },
                    }))
                  }
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the conversation including names/labels so AI can
                  understand who said what.
                </p>
              </div>
            </div>
          )}

          {/* Error and Success Messages */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Generate Summary"}
            </Button>
            <Button type="button" variant="outline" disabled={isLoading}>
              Skip for Now
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            The summary will be attached to your interaction record and can be
            edited before saving.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default PostInteractionQuestionnaireForm;
