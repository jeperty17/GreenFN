import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

type TagItem = {
  id: string;
  name: string;
};

type ContactItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  type: "LEAD" | "CLIENT";
  birthday: string | null;
  priorities: string | null;
  portfolioSummary: string | null;
  isStarred: boolean;
  tags: TagItem[];
  updatedAt: string;
};

type InteractionItem = {
  id: string;
  type: string;
  occurredAt: string;
  notes: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  contactId: string;
  contactName: string;
  stageName: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ContactDetailsPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const [contact, setContact] = useState<ContactItem | null>(null);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const activeContactId = contactId ?? "";

    if (!activeContactId) {
      setErrorMessage("Missing contact id.");
      return;
    }

    const abortController = new AbortController();

    async function fetchContactDetails() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [contactResponse, interactionsResponse, tasksResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/api/contacts/${activeContactId}`, {
              signal: abortController.signal,
            }),
            fetch(
              `${API_BASE_URL}/api/interactions?contactId=${encodeURIComponent(activeContactId)}&page=1&pageSize=100&sortDirection=desc`,
              {
                signal: abortController.signal,
              },
            ),
            fetch(`${API_BASE_URL}/api/tasks?view=calendar`, {
              signal: abortController.signal,
            }),
          ]);

        if (!contactResponse.ok) {
          throw new Error(`Failed to load contact (${contactResponse.status})`);
        }

        if (!interactionsResponse.ok) {
          throw new Error(
            `Failed to load interactions (${interactionsResponse.status})`,
          );
        }

        if (!tasksResponse.ok) {
          throw new Error(`Failed to load tasks (${tasksResponse.status})`);
        }

        const contactPayload: { item: ContactItem } =
          await contactResponse.json();
        const interactionsPayload: { items: InteractionItem[] } =
          await interactionsResponse.json();
        const tasksPayload: { tasks: TaskItem[] } = await tasksResponse.json();

        setContact(contactPayload.item);
        setInteractions(interactionsPayload.items || []);
        setTasks(
          (tasksPayload.tasks || []).filter(
            (task) => task.contactId === activeContactId,
          ),
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setErrorMessage(
          (error as Error).message || "Failed to load contact details",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchContactDetails();

    return () => {
      abortController.abort();
    };
  }, [contactId]);

  const sortedInteractions = useMemo(
    () =>
      [...interactions].sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      ),
    [interactions],
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (left, right) =>
          new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
      ),
    [tasks],
  );

  return (
    <section className="page-section space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2>Contact Details</h2>
          <p className="field-hint">
            View all fields and related records for this contact.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Back to Contacts Hub</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="field-hint">Loading contact details...</p>
      ) : null}

      {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage && contact ? (
        <>
          <div className="space-y-4 rounded-md border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold">{contact.fullName}</h3>
              <Badge variant={contact.isStarred ? "default" : "secondary"}>
                {contact.isStarred ? "Starred" : "Standard"}
              </Badge>
              <Badge variant="outline">{contact.type}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p>{contact.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p>{contact.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p>{contact.source || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Birthday</p>
                <p>{contact.birthday || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Life Priorities</p>
                <p>{contact.priorities || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Portfolio Summary
                </p>
                <p>{contact.portfolioSummary || "-"}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-2">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))
                ) : (
                  <p className="field-hint">No tags assigned.</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Last updated: {formatDateTime(contact.updatedAt)}
            </p>
          </div>

          <div className="space-y-3 rounded-md border bg-background p-4">
            <h3>Interactions</h3>
            {sortedInteractions.length === 0 ? (
              <p className="field-hint">No interactions recorded.</p>
            ) : (
              <div className="space-y-2">
                {sortedInteractions.map((interaction) => (
                  <div key={interaction.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{interaction.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(interaction.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {interaction.notes || "No notes"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border bg-background p-4">
            <h3>Open Tasks</h3>
            {sortedTasks.length === 0 ? (
              <p className="field-hint">
                No open tasks linked to this contact.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedTasks.map((task) => (
                  <div key={task.id} className="rounded-md border p-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.description || "No description"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Due: {formatDateTime(task.dueAt)}
                      {task.stageName ? ` | Stage: ${task.stageName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default ContactDetailsPage;
