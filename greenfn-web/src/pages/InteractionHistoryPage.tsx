import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

type ContactType = "LEAD" | "CLIENT";

type ContactItem = {
  id: string;
  fullName: string;
  type: ContactType;
  source: string | null;
};

type ContactsResponse = {
  items: ContactItem[];
};

type InteractionType = "CALL" | "MEETING" | "WHATSAPP_DM" | "GENERAL_NOTE";

type InteractionLog = {
  id: string;
  contactId: string;
  type: InteractionType;
  interactionDate: string;
  notes: string;
  relatedTask: {
    id: string;
    title: string;
  } | null;
};

type InteractionFormState = {
  type: InteractionType;
  interactionDate: string;
  notes: string;
};

const SAMPLE_INTERACTIONS: InteractionLog[] = [
  {
    id: "ih-001",
    contactId: "seed-contact-alice",
    type: "CALL",
    interactionDate: "2026-04-12T09:30:00.000Z",
    notes:
      "Follow-up call after product briefing. Clarified short-term liquidity concern and agreed to compare two options next week.",
    relatedTask: {
      id: "task-001",
      title: "Send product comparison summary",
    },
  },
  {
    id: "ih-002",
    contactId: "seed-contact-alice",
    type: "MEETING",
    interactionDate: "2026-04-07T03:00:00.000Z",
    notes:
      "In-person review of current portfolio allocation. Client prioritized education planning and emergency coverage.",
    relatedTask: {
      id: "task-002",
      title: "Prepare education planning options",
    },
  },
  {
    id: "ih-003",
    contactId: "seed-contact-ben",
    type: "WHATSAPP_DM",
    interactionDate: "2026-04-11T14:10:00.000Z",
    notes:
      "Sent appointment confirmation and agenda. Client confirmed Saturday slot and requested premium estimate examples.",
    relatedTask: {
      id: "task-003",
      title: "Draft premium estimate scenarios",
    },
  },
  {
    id: "ih-004",
    contactId: "seed-contact-charlotte",
    type: "GENERAL_NOTE",
    interactionDate: "2026-04-05T10:45:00.000Z",
    notes:
      "Client mentioned upcoming housing plans and asked for advice on balancing mortgage commitments with protection.",
    relatedTask: null,
  },
];

const typeLabelMap: Record<InteractionType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  WHATSAPP_DM: "WhatsApp/DM",
  GENERAL_NOTE: "General Note",
};

function currentDateTimeLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

const EMPTY_INTERACTION_FORM: InteractionFormState = {
  type: "CALL",
  interactionDate: currentDateTimeLocal(),
  notes: "",
};

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function InteractionHistoryPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [interactionLogs, setInteractionLogs] =
    useState<InteractionLog[]>(SAMPLE_INTERACTIONS);
  const [formState, setFormState] = useState<InteractionFormState>(
    EMPTY_INTERACTION_FORM,
  );
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | InteractionType>("ALL");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoadingContacts(true);
      setContactsError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/contacts?page=1&pageSize=50`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load contacts (${response.status})`);
        }

        const payload: ContactsResponse = await response.json();
        const items = payload.items || [];

        setContacts(items);
        setSelectedContactId(
          (currentValue) => currentValue || items[0]?.id || "",
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setContactsError((error as Error).message || "Failed to load contacts");
      } finally {
        setIsLoadingContacts(false);
      }
    }

    fetchContacts();

    return () => {
      abortController.abort();
    };
  }, []);

  const selectedContact = contacts.find(
    (contact) => contact.id === selectedContactId,
  );

  const timelineItems = useMemo(
    () =>
      interactionLogs
        .filter((entry) => entry.contactId === selectedContactId)
        .slice()
        .sort(
          (left, right) =>
            new Date(right.interactionDate).getTime() -
            new Date(left.interactionDate).getTime(),
        ),
    [interactionLogs, selectedContactId],
  );

  const filteredTimelineItems = useMemo(() => {
    const startBoundary = startDateFilter
      ? new Date(`${startDateFilter}T00:00:00`).getTime()
      : null;
    const endBoundary = endDateFilter
      ? new Date(`${endDateFilter}T23:59:59.999`).getTime()
      : null;

    return timelineItems.filter((entry) => {
      const entryTimestamp = new Date(entry.interactionDate).getTime();

      if (typeFilter !== "ALL" && entry.type !== typeFilter) {
        return false;
      }

      if (startBoundary !== null && entryTimestamp < startBoundary) {
        return false;
      }

      if (endBoundary !== null && entryTimestamp > endBoundary) {
        return false;
      }

      return true;
    });
  }, [endDateFilter, startDateFilter, timelineItems, typeFilter]);

  function handleResetFilters() {
    setTypeFilter("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
  }

  function handleSubmitInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedContactId) {
      setFormError("Please select a contact first.");
      return;
    }

    if (!formState.interactionDate) {
      setFormError("Interaction date is required.");
      return;
    }

    if (!formState.notes.trim()) {
      setFormError("Notes are required.");
      return;
    }

    const nextLog: InteractionLog = {
      id: `ih-${Date.now()}`,
      contactId: selectedContactId,
      type: formState.type,
      interactionDate: new Date(formState.interactionDate).toISOString(),
      notes: formState.notes.trim(),
      relatedTask: null,
    };

    setInteractionLogs((currentLogs) => [nextLog, ...currentLogs]);
    setFormState({
      ...EMPTY_INTERACTION_FORM,
      type: formState.type,
      interactionDate: currentDateTimeLocal(),
    });
    setFormSuccess("Interaction log added to timeline.");
  }

  return (
    <section className="page-shell space-y-6">
      <header className="space-y-2">
        <h2>Interaction History</h2>
        <p className="text-sm text-muted-foreground">
          Per-contact chronological timeline for calls, meetings, chat updates,
          and notes.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Select Contact</CardTitle>
          <CardDescription>
            Choose a contact to view a timeline of interaction logs.
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
                {contact.fullName} ({contact.type})
              </option>
            ))}
          </select>

          {contactsError && (
            <p className="text-sm text-destructive">Error: {contactsError}</p>
          )}

          {!contactsError && selectedContact && (
            <p className="text-sm text-muted-foreground">
              Viewing timeline for{" "}
              <span className="font-medium">{selectedContact.fullName}</span>
              {selectedContact.source ? ` (${selectedContact.source})` : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Interaction Entry</CardTitle>
          <CardDescription>
            Capture interaction type, date, and notes for the selected contact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmitInteraction}>
            <div className="form-grid">
              <div className="field-stack">
                <Label htmlFor="interactionType">Interaction Type</Label>
                <select
                  id="interactionType"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formState.type}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      type: event.target.value as InteractionType,
                    }))
                  }
                >
                  <option value="CALL">Call</option>
                  <option value="MEETING">Meeting</option>
                  <option value="WHATSAPP_DM">WhatsApp/DM</option>
                  <option value="GENERAL_NOTE">General Note</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="interactionDate">Interaction Date</Label>
                <input
                  id="interactionDate"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  type="datetime-local"
                  value={formState.interactionDate}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      interactionDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-stack">
              <Label htmlFor="interactionNotes">Notes</Label>
              <Textarea
                id="interactionNotes"
                placeholder="What happened, what was discussed, and what should happen next?"
                value={formState.notes}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            {formSuccess && (
              <p className="text-sm text-emerald-700">{formSuccess}</p>
            )}

            <Button
              type="submit"
              disabled={isLoadingContacts || !selectedContactId}
            >
              Add Interaction
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chronological Timeline</CardTitle>
          <CardDescription>
            Latest interactions are shown first for quick pre-call recall.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="form-grid">
            <div className="field-stack">
              <Label htmlFor="timelineTypeFilter">Type Filter</Label>
              <select
                id="timelineTypeFilter"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "ALL" | InteractionType)
                }
              >
                <option value="ALL">All types</option>
                <option value="CALL">Call</option>
                <option value="MEETING">Meeting</option>
                <option value="WHATSAPP_DM">WhatsApp/DM</option>
                <option value="GENERAL_NOTE">General Note</option>
              </select>
            </div>

            <div className="field-stack">
              <Label htmlFor="timelineStartDate">Start Date</Label>
              <Input
                id="timelineStartDate"
                type="date"
                value={startDateFilter}
                onChange={(event) => setStartDateFilter(event.target.value)}
              />
            </div>

            <div className="field-stack">
              <Label htmlFor="timelineEndDate">End Date</Label>
              <Input
                id="timelineEndDate"
                type="date"
                value={endDateFilter}
                onChange={(event) => setEndDateFilter(event.target.value)}
              />
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </div>

          {filteredTimelineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interaction logs match the selected filters.
            </p>
          ) : (
            <ul className="relative ml-3 border-l border-border pl-6">
              {filteredTimelineItems.map((entry) => (
                <li key={entry.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border border-primary bg-background" />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {typeLabelMap[entry.type]}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(entry.interactionDate)}
                      </p>
                    </div>
                    <p className="text-sm leading-6">{entry.notes}</p>
                    {entry.relatedTask && (
                      <p className="text-sm">
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          to={`/today?taskId=${encodeURIComponent(entry.relatedTask.id)}&contactId=${encodeURIComponent(entry.contactId)}`}
                        >
                          View task: {entry.relatedTask.title}
                        </Link>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default InteractionHistoryPage;
