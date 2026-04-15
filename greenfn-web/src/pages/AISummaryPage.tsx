import { useEffect, useState } from "react";
import PostInteractionQuestionnaireForm from "../components/PostInteractionQuestionnaireForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";

function AISummaryPage() {
  const [contacts, setContacts] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoadingContacts(true);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"}/api/contacts?page=1&pageSize=50`,
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

      {selectedContactId && (
        <PostInteractionQuestionnaireForm
          onSubmit={(data) => {
            console.log("Questionnaire submitted:", data);
          }}
        />
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
