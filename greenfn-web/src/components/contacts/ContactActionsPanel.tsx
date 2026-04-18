/**
 * ContactActionsPanel — sticky side panel that appears to the right of the
 * contacts table when a row's ⋯ button is clicked. Provides Edit, Delete, and
 * tag assignment/removal for the selected contact.
 */
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { getAvatarStyle } from "./contactUtils";
import type { ContactItem, TagItem } from "../../types/contacts";

interface ContactActionsPanelProps {
  contact: ContactItem;
  availableTags: TagItem[];
  onEdit: () => void;
  onDelete: () => void;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onClose: () => void;
}

function ContactActionsPanel({
  contact,
  availableTags,
  onEdit,
  onDelete,
  onAssignTag,
  onRemoveTag,
  onClose,
}: ContactActionsPanelProps) {
  /* Controlled select resets to placeholder after each assignment. */
  const [pendingTagId, setPendingTagId] = useState("");

  const unassignedTags = availableTags.filter(
    (t) => !contact.tags.some((ct) => ct.id === t.id),
  );

  function handleTagSelect(tagId: string) {
    if (!tagId) return;
    onAssignTag(tagId);
    setPendingTagId("");
  }

  return (
    <div className="w-52 shrink-0 self-start sticky top-4 rounded-lg border bg-card p-4 shadow-sm">
      {/* Header: avatar + name + close */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={getAvatarStyle(contact.fullName)}
          >
            {contact.fullName.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium">{contact.fullName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Primary actions */}
      <div className="mb-3 space-y-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          Edit contact
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-muted"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {/* Tags section */}
      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tags
        </p>

        {/* Existing tags with remove button */}
        {contact.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {contact.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag.id)}
                  className="ml-0.5 transition-colors hover:text-destructive"
                  title="Remove tag"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Dropdown to assign a new tag */}
        {unassignedTags.length > 0 ? (
          <select
            value={pendingTagId}
            onChange={(e) => handleTagSelect(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            <option value="">+ Add tag…</option>
            {unassignedTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        ) : (
          contact.tags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No tags available. Create one via Manage Tags.
            </p>
          )
        )}
      </div>
    </div>
  );
}

export default ContactActionsPanel;
