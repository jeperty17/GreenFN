/**
 * ContactsHubPage — container page for the Contacts Hub. Owns all state and
 * API calls; passes data and handlers down to presentational components.
 * Does not render any UI directly beyond the layout shell.
 */
import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { API_BASE_URL } from "../config/env";
import { Button } from "../components/ui/button";
import ContactsFilterBar from "../components/contacts/ContactsFilterBar";
import ContactsTable from "../components/contacts/ContactsTable";
import ContactDrawer from "../components/contacts/ContactDrawer";
import ContactsPagination from "../components/contacts/ContactsPagination";
import type {
  ContactFormState,
  ContactItem,
  ContactsResponse,
  FormMode,
  TagItem,
} from "../types/contacts";

const DEFAULT_PAGE_SIZE = 6;

const EMPTY_CONTACT_FORM: ContactFormState = {
  fullName: "",
  phone: "",
  email: "",
  type: "LEAD",
  source: "",
  birthday: "",
  priorities: "",
  portfolioSummary: "",
  tagNames: "",
  isStarred: false,
};

function mapContactToForm(contact: ContactItem): ContactFormState {
  return {
    fullName: contact.fullName,
    phone: contact.phone || "",
    email: contact.email || "",
    type: contact.type,
    source: contact.source || "",
    birthday: contact.birthday || "",
    priorities: contact.priorities || "",
    portfolioSummary: contact.portfolioSummary || "",
    tagNames: contact.tags.map((t) => t.name).join(", "),
    isStarred: contact.isStarred,
  };
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const baseMessage =
      payload?.error?.message || `Request failed (${response.status})`;
    const details = Array.isArray(payload?.error?.details)
      ? payload.error.details.map(
          (d: { field: string; message: string }) => `${d.field}: ${d.message}`,
        )
      : [];
    if (details.length > 0) return `${baseMessage}. ${details.join("; ")}`;
    return baseMessage;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function ContactsHubPage() {
  /* ── Filter state ────────────────────────────────────────────── */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [page, setPage] = useState(1);

  /* ── Data state ──────────────────────────────────────────────── */
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<ContactsResponse["pagination"]>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  /* ── Form / drawer state ─────────────────────────────────────── */
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [formSuccessMessage, setFormSuccessMessage] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  /* ── Tag management state ────────────────────────────────────── */
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagErrorMessage, setTagErrorMessage] = useState("");

  /* ── Query string ────────────────────────────────────────────── */
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(DEFAULT_PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (type) params.set("type", type);
    if (source.trim()) params.set("source", source.trim());
    if (tagFilter.trim()) params.set("tag", tagFilter.trim());
    return params.toString();
  }, [page, search, type, source, tagFilter]);

  /* ── Data fetching ───────────────────────────────────────────── */
  useEffect(() => {
    const ctrl = new AbortController();
    async function fetchContacts() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(`${API_BASE_URL}/api/contacts?${queryString}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Failed to load contacts (${res.status})`);
        const payload: ContactsResponse = await res.json();
        setContacts(payload.items);
        setPagination(payload.pagination);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMessage((err as Error).message || "Failed to load contacts");
      } finally {
        setIsLoading(false);
      }
    }
    fetchContacts();
    return () => ctrl.abort();
  }, [queryString, refreshKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    async function fetchTags() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/contacts/tags`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
        const payload: { items: TagItem[] } = await res.json();
        setAvailableTags(payload.items);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setTagErrorMessage((err as Error).message || "Failed to load tags");
      }
    }
    fetchTags();
    return () => ctrl.abort();
  }, [refreshKey]);

  /* ── Helpers ─────────────────────────────────────────────────── */
  function syncContactInList(updated: ContactItem) {
    setContacts((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleApplySearch() {
    setPage(1);
    setSearch(searchInput);
  }

  function handleClearFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setSource("");
    setTagFilter("");
    setPage(1);
  }

  /* true when at least one filter is actively narrowing results */
  const hasActiveFilters =
    search !== "" || type !== "" || source.trim() !== "" || tagFilter !== "";

  function handleStartCreate() {
    setFormMode("create");
    setEditingContactId(null);
    setFormState(EMPTY_CONTACT_FORM);
    setFormErrorMessage("");
    setFormSuccessMessage("");
  }

  function handleStartEdit(contact: ContactItem) {
    setFormMode("edit");
    setEditingContactId(contact.id);
    setFormState(mapContactToForm(contact));
    setFormErrorMessage("");
    setFormSuccessMessage("");
  }

  function updateFormField<K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) {
    setFormState((s) => ({ ...s, [key]: value }));
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
    handleStartCreate();
  }

  /* ── Handlers ────────────────────────────────────────────────── */
  async function handleSubmitContactForm(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErrorMessage("");
    setFormSuccessMessage("");
    if (!formState.fullName.trim()) {
      setFormErrorMessage("fullName is required");
      return;
    }
    setIsSubmittingForm(true);
    try {
      const body = {
        fullName: formState.fullName,
        phone: formState.phone,
        email: formState.email,
        type: formState.type,
        source: formState.source,
        birthday: formState.birthday,
        priorities: formState.priorities,
        portfolioSummary: formState.portfolioSummary,
        tagNames: formState.tagNames
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isStarred: formState.isStarred,
      };
      const url =
        formMode === "create"
          ? `${API_BASE_URL}/api/contacts`
          : `${API_BASE_URL}/api/contacts/${editingContactId}`;
      const res = await fetch(url, {
        method: formMode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      handleStartCreate();
      setFormSuccessMessage(
        formMode === "create"
          ? "Contact created successfully."
          : "Contact updated successfully.",
      );
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setFormErrorMessage(
        (err as Error).message || "Failed to submit contact form",
      );
    } finally {
      setIsSubmittingForm(false);
    }
  }

  async function handleCreateTag() {
    setTagErrorMessage("");
    if (!newTagName.trim()) {
      setTagErrorMessage("Tag name is required");
      return;
    }
    setIsCreatingTag(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      setNewTagName("");
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setTagErrorMessage((err as Error).message || "Failed to create tag");
    } finally {
      setIsCreatingTag(false);
    }
  }

  async function handleDeleteTag(tagId: string) {
    setTagErrorMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      setAvailableTags((tags) => tags.filter((t) => t.id !== tagId));
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setTagErrorMessage((err as Error).message || "Failed to delete tag");
    }
  }

  async function handleToggleStar(contact: ContactItem) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/contacts/${contact.id}/starred`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isStarred: !contact.isStarred }),
        },
      );
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const payload: { item: ContactItem } = await res.json();
      syncContactInList(payload.item);
    } catch (err) {
      setTagErrorMessage(
        (err as Error).message || "Failed to toggle focus marker",
      );
    }
  }

  async function handleDeleteContact(contact: ContactItem) {
    const confirmed = window.confirm(
      `Delete contact ${contact.fullName}? This action cannot be undone.`,
    );
    if (!confirmed) return;
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      if (editingContactId === contact.id) handleStartCreate();
      setContacts((cs) => cs.filter((c) => c.id !== contact.id));
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to delete contact");
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* ── Top bar: title + count + add button ───────────────── */}
      <div className="flex items-center justify-between">
        {/* h1 (Sora text-3xl font-semibold) + count badge inline for authority */}
        <div className="flex items-center gap-3">
          <h1>Contacts</h1>
          <span className="rounded-full bg-secondary px-3 py-0.5 text-sm font-semibold text-primary">
            {pagination.total} contact{pagination.total !== 1 && "s"}
          </span>
        </div>
        <Button
          type="button"
          onClick={() => {
            handleStartCreate();
            setIsDrawerOpen(true);
          }}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <ContactsFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchApply={handleApplySearch}
        type={type}
        onTypeChange={(v) => {
          setType(v);
          setPage(1);
        }}
        source={source}
        onSourceChange={(v) => {
          setSource(v);
          setPage(1);
        }}
        tagFilter={tagFilter}
        onTagFilterChange={(v) => {
          setTagFilter(v);
          setPage(1);
        }}
        availableTags={availableTags}
        newTagName={newTagName}
        isCreatingTag={isCreatingTag}
        tagErrorMessage={tagErrorMessage}
        onNewTagNameChange={setNewTagName}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* ── Error banner ──────────────────────────────────────── */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div>
        <ContactsTable
          contacts={contacts}
          isLoading={isLoading}
          onToggleStar={handleToggleStar}
          onEdit={(contact) => {
            handleStartEdit(contact);
            setIsDrawerOpen(true);
          }}
          onDelete={handleDeleteContact}
        />
        <ContactsPagination
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={setPage}
        />
      </div>

      {/* ── Add / Edit drawer ─────────────────────────────────── */}
      <ContactDrawer
        isOpen={isDrawerOpen}
        formMode={formMode}
        formState={formState}
        formErrorMessage={formErrorMessage}
        formSuccessMessage={formSuccessMessage}
        isSubmittingForm={isSubmittingForm}
        onClose={handleCloseDrawer}
        onSubmit={handleSubmitContactForm}
        onUpdateField={updateFormField}

      />
    </div>
  );
}

export default ContactsHubPage;
