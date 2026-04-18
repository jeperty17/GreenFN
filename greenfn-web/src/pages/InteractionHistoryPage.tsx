/*
 * InteractionHistoryPage fetches contact-scoped interaction data, manages
 * filters/form state, and composes reusable interaction UI components.
 */
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/env";
import { Button } from "../components/ui/button";
import {
  InteractionDetailsModal,
  InteractionOverviewCard,
  InteractionTimelineCard,
  LogInteractionModal,
} from "../components/interactions";
import type {
  ContactItem,
  InteractionFormState,
  InteractionLog,
  InteractionType,
} from "../components/interactions/types";

type ContactsResponse = {
  items: ContactItem[];
};

type InteractionApiItem = {
  id: string;
  contactId: string;
  type: string;
  title?: string | null;
  occurredAt: string;
  notes: string | null;
  aiSummaryLink?: {
    summaryText?: string | null;
    model?: string | null;
    sourceMode?: string | null;
    generatedAt?: string | null;
  } | null;
};

type InteractionsResponse = {
  items: InteractionApiItem[];
};

function normalizeInteractionType(type: string): InteractionType {
  const normalizedType = String(type || "")
    .trim()
    .toUpperCase();

  if (normalizedType === "CALL" || normalizedType === "MEETING") {
    return normalizedType;
  }

  if (
    normalizedType === "WHATSAPP_DM" ||
    normalizedType === "WHATSAPP" ||
    normalizedType === "TELEGRAM" ||
    normalizedType === "INSTAGRAM" ||
    normalizedType === "EMAIL"
  ) {
    return "WHATSAPP_DM";
  }

  return "GENERAL_NOTE";
}

function mapInteractionFromApi(item: InteractionApiItem): InteractionLog {
  return {
    id: item.id,
    contactId: item.contactId,
    type: normalizeInteractionType(item.type),
    title: item.title || null,
    interactionDate: item.occurredAt,
    notes: item.notes || "",
    aiSummaryLink: item.aiSummaryLink
      ? {
          summaryText: item.aiSummaryLink.summaryText || null,
          model: item.aiSummaryLink.model || null,
          sourceMode: item.aiSummaryLink.sourceMode || null,
          generatedAt: item.aiSummaryLink.generatedAt || null,
        }
      : null,
    relatedTask: null,
  };
}

function currentDateTimeLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

const EMPTY_INTERACTION_FORM: InteractionFormState = {
  type: "CALL",
  interactionDate: currentDateTimeLocal(),
  title: "",
  notes: "",
  aiSummaryDraft: "",
  aiSummaryModel: null,
  aiSummarySourceMode: null,
  aiSummaryGeneratedAt: null,
};

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatMonthLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    year: "numeric",
  })
    .format(new Date(dateString))
    .toUpperCase();
}

function formatLastActivity(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "—";

  const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function InteractionHistoryPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [interactionLogs, setInteractionLogs] = useState<InteractionLog[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const [interactionsError, setInteractionsError] = useState("");
  const [isSavingInteraction, setIsSavingInteraction] = useState(false);
  const [formState, setFormState] = useState<InteractionFormState>(
    EMPTY_INTERACTION_FORM,
  );
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isLogInteractionModalOpen, setIsLogInteractionModalOpen] =
    useState(false);
  const [selectedInteractionId, setSelectedInteractionId] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | InteractionType>("ALL");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [notesSearchFilter, setNotesSearchFilter] = useState("");

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

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchInteractions() {
      if (!selectedContactId) {
        setInteractionLogs([]);
        return;
      }

      setIsLoadingInteractions(true);
      setInteractionsError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/interactions?contactId=${encodeURIComponent(selectedContactId)}&page=1&pageSize=200&sortDirection=desc`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error(`Failed to load interactions (${response.status})`);
        }

        const payload: InteractionsResponse = await response.json();
        setInteractionLogs((payload.items || []).map(mapInteractionFromApi));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setInteractionsError(
          (error as Error).message || "Failed to load interactions",
        );
      } finally {
        setIsLoadingInteractions(false);
      }
    }

    fetchInteractions();

    return () => {
      abortController.abort();
    };
  }, [selectedContactId]);

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

      if (notesSearchFilter.trim()) {
        const query = notesSearchFilter.toLowerCase();
        if (!entry.notes.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    endDateFilter,
    notesSearchFilter,
    startDateFilter,
    timelineItems,
    typeFilter,
  ]);

  const timelineStats = useMemo(() => {
    const total = filteredTimelineItems.length;
    const calls = filteredTimelineItems.filter(
      (entry) => entry.type === "CALL",
    ).length;
    const meetings = filteredTimelineItems.filter(
      (entry) => entry.type === "MEETING",
    ).length;
    const chats = filteredTimelineItems.filter(
      (entry) => entry.type === "WHATSAPP_DM",
    ).length;
    const notes = filteredTimelineItems.filter(
      (entry) => entry.type === "GENERAL_NOTE",
    ).length;
    const lastActivity = filteredTimelineItems[0]?.interactionDate || null;

    return {
      total,
      calls,
      meetings,
      chats,
      notes,
      lastActivity,
    };
  }, [filteredTimelineItems]);

  const typePills = useMemo(
    () => [
      {
        key: "ALL" as const,
        label: "All",
        count: timelineItems.length,
      },
      {
        key: "CALL" as const,
        label: "Calls",
        count: timelineItems.filter((entry) => entry.type === "CALL").length,
      },
      {
        key: "MEETING" as const,
        label: "Meetings",
        count: timelineItems.filter((entry) => entry.type === "MEETING").length,
      },
      {
        key: "WHATSAPP_DM" as const,
        label: "WhatsApp",
        count: timelineItems.filter((entry) => entry.type === "WHATSAPP_DM")
          .length,
      },
      {
        key: "GENERAL_NOTE" as const,
        label: "Notes",
        count: timelineItems.filter((entry) => entry.type === "GENERAL_NOTE")
          .length,
      },
    ],
    [timelineItems],
  );

  const timelineGroups = useMemo(() => {
    const grouped = new Map<string, InteractionLog[]>();

    for (const entry of filteredTimelineItems) {
      const key = formatMonthLabel(entry.interactionDate);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(entry);
    }

    return Array.from(grouped.entries()).map(([month, items]) => ({
      month,
      items,
    }));
  }, [filteredTimelineItems]);

  const selectedInteraction = useMemo(
    () =>
      timelineItems.find((entry) => entry.id === selectedInteractionId) || null,
    [selectedInteractionId, timelineItems],
  );

  function handleResetFilters() {
    setTypeFilter("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
    setNotesSearchFilter("");
  }

  async function handleSubmitInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedContactId) {
      setFormError("Please select a contact first");
      return;
    }

    if (!formState.interactionDate) {
      setFormError("Interaction date is required");
      return;
    }

    if (!formState.title.trim()) {
      setFormError("Interaction title is required");
      return;
    }

    if (!formState.notes.trim()) {
      setFormError("Notes are required");
      return;
    }

    setIsSavingInteraction(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: selectedContactId,
          type: formState.type,
          occurredAt: new Date(formState.interactionDate).toISOString(),
          title: formState.title.trim(),
          notes: formState.notes.trim(),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const apiErrorMessage = errorPayload?.error?.message;
        throw new Error(
          apiErrorMessage || `Failed to save interaction (${response.status})`,
        );
      }

      const payload = await response.json();
      let created = mapInteractionFromApi(payload.item as InteractionApiItem);

      if (formState.aiSummaryDraft.trim()) {
        const linkResponse = await fetch(
          `${API_BASE_URL}/api/interactions/${encodeURIComponent(created.id)}/summary-link`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summaryText: formState.aiSummaryDraft.trim(),
              model: formState.aiSummaryModel,
              sourceMode: formState.aiSummarySourceMode || "notes",
              generatedAt:
                formState.aiSummaryGeneratedAt || new Date().toISOString(),
            }),
          },
        );

        if (!linkResponse.ok) {
          const linkErrorPayload = await linkResponse.json().catch(() => null);
          const linkErrorMessage =
            linkErrorPayload?.error?.message ||
            `Summary link failed (${linkResponse.status})`;
          throw new Error(linkErrorMessage);
        }

        const linkedPayload = await linkResponse.json();
        created = mapInteractionFromApi(
          linkedPayload.item as InteractionApiItem,
        );

        toast.success("Interaction saved and AI summary linked");
      } else {
        toast.success("Interaction saved successfully");
      }

      setInteractionLogs((currentLogs) => [created, ...currentLogs]);
      setFormState({
        ...EMPTY_INTERACTION_FORM,
        type: formState.type,
        interactionDate: currentDateTimeLocal(),
      });
      setFormSuccess("Interaction saved to database");
      setIsLogInteractionModalOpen(false);
    } catch (error) {
      setFormError((error as Error).message || "Failed to save interaction");
    } finally {
      setIsSavingInteraction(false);
    }
  }

  return (
    <section className="page-shell space-y-7">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1>Interaction History</h1>
        </div>
        <Button
          type="button"
          className="flex items-center gap-1.5"
          onClick={() => {
            setFormError("");
            setFormSuccess("");
            setIsLogInteractionModalOpen(true);
          }}
          disabled={!selectedContactId || isLoadingContacts}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Log interaction
        </Button>
      </header>

      {formSuccess && (
        <p className="rounded-lg border border-[oklch(0.86_0.03_145)] bg-[oklch(0.96_0.03_145)] px-3 py-2.5 text-base font-medium leading-6 text-[oklch(0.33_0.1_145)]">
          {formSuccess}
        </p>
      )}

      <InteractionOverviewCard
        contacts={contacts}
        selectedContactId={selectedContactId}
        isLoadingContacts={isLoadingContacts}
        contactsError={contactsError}
        selectedContact={selectedContact}
        timelineStats={timelineStats}
        onSelectContact={setSelectedContactId}
        formatLastActivity={formatLastActivity}
      />

      <InteractionTimelineCard
        interactionsError={interactionsError}
        isLoadingInteractions={isLoadingInteractions}
        filteredTimelineItemsCount={filteredTimelineItems.length}
        typePills={typePills}
        typeFilter={typeFilter}
        startDateFilter={startDateFilter}
        endDateFilter={endDateFilter}
        notesSearchFilter={notesSearchFilter}
        timelineGroups={timelineGroups}
        onSetTypeFilter={setTypeFilter}
        onSetStartDateFilter={setStartDateFilter}
        onSetEndDateFilter={setEndDateFilter}
        onSetNotesSearchFilter={setNotesSearchFilter}
        onResetFilters={handleResetFilters}
        formatDateTime={formatDateTime}
        onOpenInteraction={(interactionId) => {
          setSelectedInteractionId(interactionId);
        }}
      />

      <LogInteractionModal
        isOpen={isLogInteractionModalOpen}
        isSavingInteraction={isSavingInteraction}
        isLoadingContacts={isLoadingContacts}
        selectedContactId={selectedContactId}
        selectedContactName={selectedContact?.fullName || "this contact"}
        formState={formState}
        formError={formError}
        onClose={() => {
          if (!isSavingInteraction) {
            setIsLogInteractionModalOpen(false);
          }
        }}
        onSubmit={handleSubmitInteraction}
        onSetFormState={setFormState}
      />

      <InteractionDetailsModal
        isOpen={Boolean(selectedInteraction)}
        interaction={selectedInteraction}
        contactName={selectedContact?.fullName || "Unknown contact"}
        onClose={() => setSelectedInteractionId("")}
        formatDateTime={formatDateTime}
      />
    </section>
  );
}

export default InteractionHistoryPage;
