import { type FormEvent, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config/env";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

type ContactType = "LEAD" | "CLIENT";

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
  type: ContactType;
  birthday: string | null;
  priorities: string | null;
  portfolioSummary: string | null;
  isStarred: boolean;
  tags: TagItem[];
  updatedAt: string;
};

type ContactsResponse = {
  items: ContactItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

type ContactFormState = {
  fullName: string;
  phone: string;
  email: string;
  type: ContactType;
  source: string;
  birthday: string;
  priorities: string;
  portfolioSummary: string;
  tagNames: string;
  isStarred: boolean;
};

type FormMode = "create" | "edit";

const DEFAULT_PAGE_SIZE = 10;

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
    tagNames: contact.tags.map((tag) => tag.name).join(", "),
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
          (detail: { field: string; message: string }) =>
            `${detail.field}: ${detail.message}`,
        )
      : [];

    if (details.length > 0) {
      return `${baseMessage}. ${details.join("; ")}`;
    }

    return baseMessage;
  } catch (_error) {
    return `Request failed (${response.status})`;
  }
}

function ContactsHubPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [starred, setStarred] = useState("");
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [formSuccessMessage, setFormSuccessMessage] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagErrorMessage, setTagErrorMessage] = useState("");
  const [rowTagSelection, setRowTagSelection] = useState<
    Record<string, string>
  >({});

  const [pagination, setPagination] = useState<ContactsResponse["pagination"]>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("page", String(page));
    params.set("pageSize", String(DEFAULT_PAGE_SIZE));

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (type) {
      params.set("type", type);
    }

    if (source.trim()) {
      params.set("source", source.trim());
    }

    if (tagFilter.trim()) {
      params.set("tag", tagFilter.trim());
    }

    if (starred) {
      params.set("starred", starred);
    }

    return params.toString();
  }, [page, search, type, source, tagFilter, starred]);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/contacts?${queryString}`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load contacts (${response.status})`);
        }

        const payload: ContactsResponse = await response.json();
        setContacts(payload.items);
        setPagination(payload.pagination);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setErrorMessage((error as Error).message || "Failed to load contacts");
      } finally {
        setIsLoading(false);
      }
    }

    fetchContacts();

    return () => {
      abortController.abort();
    };
  }, [queryString, refreshKey]);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchTags() {
      setTagErrorMessage("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/contacts/tags`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load tags (${response.status})`);
        }

        const payload: { items: TagItem[] } = await response.json();
        setAvailableTags(payload.items);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setTagErrorMessage((error as Error).message || "Failed to load tags");
      }
    }

    fetchTags();

    return () => {
      abortController.abort();
    };
  }, [refreshKey]);

  function handleApplyFilters() {
    setPage(1);
    setSearch(searchInput);
  }

  function handleResetFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setSource("");
    setTagFilter("");
    setStarred("");
    setPage(1);
  }

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

  async function handleSubmitContactForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrorMessage("");
    setFormSuccessMessage("");

    if (!formState.fullName.trim()) {
      setFormErrorMessage("fullName is required");
      return;
    }

    setIsSubmittingForm(true);

    try {
      const payload = {
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
          .map((tagName) => tagName.trim())
          .filter(Boolean),
        isStarred: formState.isStarred,
      };

      const requestUrl =
        formMode === "create"
          ? `${API_BASE_URL}/api/contacts`
          : `${API_BASE_URL}/api/contacts/${editingContactId}`;

      const response = await fetch(requestUrl, {
        method: formMode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      handleStartCreate();
      setFormSuccessMessage(
        formMode === "create"
          ? "Contact created successfully."
          : "Contact updated successfully.",
      );
      setRefreshKey((currentValue) => currentValue + 1);
    } catch (error) {
      setFormErrorMessage(
        (error as Error).message || "Failed to submit contact form",
      );
    } finally {
      setIsSubmittingForm(false);
    }
  }

  function updateFormState<K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  function syncContactInList(updatedContact: ContactItem) {
    setContacts((currentContacts) =>
      currentContacts.map((contact) =>
        contact.id === updatedContact.id ? updatedContact : contact,
      ),
    );
  }

  async function handleCreateTag() {
    setTagErrorMessage("");

    if (!newTagName.trim()) {
      setTagErrorMessage("Tag name is required");
      return;
    }

    setIsCreatingTag(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      setNewTagName("");
      setRefreshKey((currentValue) => currentValue + 1);
    } catch (error) {
      setTagErrorMessage((error as Error).message || "Failed to create tag");
    } finally {
      setIsCreatingTag(false);
    }
  }

  async function handleAssignTag(contactId: string) {
    const tagId = rowTagSelection[contactId];

    if (!tagId) {
      return;
    }

    setTagErrorMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/contacts/${contactId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: [tagId] }),
        },
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload: { item: ContactItem } = await response.json();
      syncContactInList(payload.item);
      setRowTagSelection((currentSelections) => ({
        ...currentSelections,
        [contactId]: "",
      }));
    } catch (error) {
      setTagErrorMessage((error as Error).message || "Failed to assign tag");
    }
  }

  async function handleRemoveTag(contactId: string, tagId: string) {
    setTagErrorMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/contacts/${contactId}/tags/${tagId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload: { item: ContactItem } = await response.json();
      syncContactInList(payload.item);
    } catch (error) {
      setTagErrorMessage((error as Error).message || "Failed to remove tag");
    }
  }

  async function handleToggleStar(contact: ContactItem) {
    setTagErrorMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/contacts/${contact.id}/starred`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isStarred: !contact.isStarred }),
        },
      );

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload: { item: ContactItem } = await response.json();
      syncContactInList(payload.item);
    } catch (error) {
      setTagErrorMessage(
        (error as Error).message || "Failed to toggle focus marker",
      );
    }
  }

  return (
    <section className="page-section space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Contacts Hub</h2>
          <p className="field-hint">
            Track leads and clients in one table with quick filtering.
          </p>
        </div>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {pagination.total} total contact{pagination.total === 1 ? "" : "s"}
        </div>
      </div>

      <form
        onSubmit={handleSubmitContactForm}
        className="space-y-4 rounded-md border bg-background p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3>{formMode === "create" ? "Create Contact" : "Edit Contact"}</h3>
          {formMode === "edit" ? (
            <Button type="button" variant="outline" onClick={handleStartCreate}>
              Switch To Create
            </Button>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field-stack">
            <Label htmlFor="contact-full-name">Full Name</Label>
            <Input
              id="contact-full-name"
              value={formState.fullName}
              onChange={(event) =>
                updateFormState("fullName", event.target.value)
              }
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-type">Type</Label>
            <select
              id="contact-type"
              value={formState.type}
              onChange={(event) =>
                updateFormState("type", event.target.value as ContactType)
              }
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="LEAD">Lead</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              value={formState.phone}
              onChange={(event) => updateFormState("phone", event.target.value)}
              placeholder="+65..."
            />
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={formState.email}
              onChange={(event) => updateFormState("email", event.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-source">Acquisition Source</Label>
            <Input
              id="contact-source"
              value={formState.source}
              onChange={(event) =>
                updateFormState("source", event.target.value)
              }
              placeholder="Referral, cold call, social"
            />
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-birthday">Birthday</Label>
            <Input
              id="contact-birthday"
              type="date"
              value={formState.birthday}
              onChange={(event) =>
                updateFormState("birthday", event.target.value)
              }
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field-stack">
            <Label htmlFor="contact-priorities">Life Priorities</Label>
            <Textarea
              id="contact-priorities"
              value={formState.priorities}
              onChange={(event) =>
                updateFormState("priorities", event.target.value)
              }
              placeholder="Children education, retirement, legacy planning"
            />
          </div>

          <div className="field-stack">
            <Label htmlFor="contact-portfolio-summary">
              Portfolio Summary (Optional)
            </Label>
            <Textarea
              id="contact-portfolio-summary"
              value={formState.portfolioSummary}
              onChange={(event) =>
                updateFormState("portfolioSummary", event.target.value)
              }
              placeholder="Short summary of policies and holdings"
            />
          </div>
        </div>

        <div className="field-stack">
          <Label htmlFor="contact-tags">Tags (comma-separated)</Label>
          <Input
            id="contact-tags"
            value={formState.tagNames}
            onChange={(event) =>
              updateFormState("tagNames", event.target.value)
            }
            placeholder="High Priority, Follow Up"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formState.isStarred}
            onChange={(event) =>
              updateFormState("isStarred", event.target.checked)
            }
          />
          Mark as starred/focus contact
        </label>

        {formErrorMessage ? (
          <p className="field-error">{formErrorMessage}</p>
        ) : null}
        {formSuccessMessage ? (
          <p className="field-hint text-foreground">{formSuccessMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmittingForm}>
            {isSubmittingForm
              ? "Saving..."
              : formMode === "create"
                ? "Create Contact"
                : "Update Contact"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleStartCreate}
            disabled={isSubmittingForm}
          >
            Reset Form
          </Button>
        </div>
      </form>

      <div className="space-y-3 rounded-md border bg-background p-4">
        <h3>Tag Management</h3>
        <div className="flex flex-wrap gap-2">
          <Input
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Create a new tag"
            className="max-w-xs"
          />
          <Button
            type="button"
            onClick={handleCreateTag}
            disabled={isCreatingTag}
          >
            {isCreatingTag ? "Creating..." : "Create Tag"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.length > 0 ? (
            availableTags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))
          ) : (
            <p className="field-hint">
              No tags yet. Create one to start assigning.
            </p>
          )}
        </div>
        {tagErrorMessage ? (
          <p className="field-error">{tagErrorMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search name, email, phone"
          className="md:col-span-2"
        />
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="LEAD">Lead</option>
          <option value="CLIENT">Client</option>
        </select>
        <Input
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setPage(1);
          }}
          placeholder="Filter by source"
        />
        <Input
          value={tagFilter}
          onChange={(event) => {
            setTagFilter(event.target.value);
            setPage(1);
          }}
          placeholder="Filter by tag"
        />
        <select
          value={starred}
          onChange={(event) => {
            setStarred(event.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All star states</option>
          <option value="true">Starred only</option>
          <option value="false">Not starred</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleApplyFilters}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={handleResetFilters}>
          Reset
        </Button>
      </div>

      {errorMessage ? <p className="field-error">{errorMessage}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/70 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Tags</th>
              <th className="px-3 py-2 font-medium">Focus</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-5 text-center text-muted-foreground"
                >
                  Loading contacts...
                </td>
              </tr>
            ) : null}

            {!isLoading && contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-5 text-center text-muted-foreground"
                >
                  No contacts found with current filters.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? contacts.map((contact) => (
                  <tr key={contact.id} className="border-t align-top">
                    <td className="px-3 py-3 font-medium">
                      {contact.fullName}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full border px-2 py-1 text-xs">
                        {contact.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.source || "-"}
                    </td>
                    <td className="space-y-1 px-3 py-3 text-muted-foreground">
                      <p>{contact.email || "-"}</p>
                      <p>{contact.phone || "-"}</p>
                    </td>
                    <td className="space-y-2 px-3 py-3 text-muted-foreground">
                      {contact.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                handleRemoveTag(contact.id, tag.id)
                              }
                              className="inline-flex items-center rounded-full border px-2 py-1 text-xs hover:bg-accent"
                              title="Remove tag"
                            >
                              {tag.name} x
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p>-</p>
                      )}
                      <div className="flex items-center gap-1">
                        <select
                          value={rowTagSelection[contact.id] || ""}
                          onChange={(event) =>
                            setRowTagSelection((currentSelections) => ({
                              ...currentSelections,
                              [contact.id]: event.target.value,
                            }))
                          }
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">Select tag</option>
                          {availableTags
                            .filter(
                              (tag) =>
                                !contact.tags.some(
                                  (contactTag) => contactTag.id === tag.id,
                                ),
                            )
                            .map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {tag.name}
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignTag(contact.id)}
                        >
                          Add
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={contact.isStarred ? "default" : "outline"}
                        onClick={() => handleToggleStar(contact)}
                      >
                        {contact.isStarred ? "Starred" : "Mark Star"}
                      </Button>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(contact)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!pagination.hasPreviousPage || isLoading}
            onClick={() =>
              setPage((currentPage) => Math.max(1, currentPage - 1))
            }
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!pagination.hasNextPage || isLoading}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ContactsHubPage;
