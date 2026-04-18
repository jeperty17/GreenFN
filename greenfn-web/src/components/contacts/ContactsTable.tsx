/**
 * ContactsTable — renders the contacts table with avatar initials, type pills,
 * tag truncation, a star toggle, and inline edit/delete icon buttons per row.
 */
import { Link } from "react-router-dom";
import { Pencil, Star, Trash2 } from "lucide-react";
import { getAvatarStyle } from "./contactUtils";
import type { ContactItem } from "../../types/contacts";

interface ContactsTableProps {
  contacts: ContactItem[];
  isLoading: boolean;
  onToggleStar: (contact: ContactItem) => void;
  onEdit: (contact: ContactItem) => void;
  onDelete: (contact: ContactItem) => void;
}

function ContactsTable({
  contacts,
  isLoading,
  onToggleStar,
  onEdit,
  onDelete,
}: ContactsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b bg-secondary/40">
            <th className="w-[22%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary/70">
              Name
            </th>
            <th className="w-[18%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-primary/70">
              Type
            </th>
            <th className="w-[17%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary/70">
              Source
            </th>
            <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary/70">
              Tags
            </th>
            <th className="w-[11%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-primary/70">
              Focus
            </th>
            <th className="w-[9%] px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td
                colSpan={6}
                className="px-6 py-10 text-center text-sm text-muted-foreground"
              >
                Loading contacts…
              </td>
            </tr>
          )}

          {!isLoading && contacts.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-6 py-10 text-center text-sm text-muted-foreground"
              >
                No contacts match your filters.
              </td>
            </tr>
          )}

          {!isLoading &&
            contacts.map((contact) => (
              <tr
                key={contact.id}
                className={`border-b transition-colors last:border-0 hover:bg-muted/50 ${
                  contact.isStarred ? "bg-amber-50/40" : ""
                }`}
              >
                {/* Name + email + phone stacked under avatar initial */}
                <td className="overflow-hidden px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={getAvatarStyle(contact.fullName)}
                    >
                      {contact.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/contacts/${contact.id}`}
                        className="block truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {contact.fullName}
                      </Link>
                      {contact.email && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type — amber for Lead (potential), brand green for Client (converted) */}
                <td className="px-4 py-3.5 text-center">
                  {contact.type === "LEAD" ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      Lead
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">
                      Client
                    </span>
                  )}
                </td>

                <td className="px-4 py-3.5 text-sm text-muted-foreground">
                  {contact.source || "—"}
                </td>

                {/* Tags — show first 2, "+N more" tooltip for the rest; brand-tinted pills */}
                <td className="px-4 py-3.5">
                  {contact.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span
                          className="inline-flex cursor-default items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                          title={contact.tags
                            .slice(2)
                            .map((t) => t.name)
                            .join(", ")}
                        >
                          +{contact.tags.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Star toggle — amber when starred, muted outline when not */}
                <td className="px-4 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleStar(contact)}
                    className="rounded p-1 transition-colors hover:bg-muted"
                    title={
                      contact.isStarred ? "Remove from focus" : "Mark as focus"
                    }
                  >
                    <Star
                      className={`h-4 w-4 transition-colors ${
                        contact.isStarred
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                </td>

                {/* Inline edit + delete icon buttons */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(contact)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit contact"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(contact)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      title="Delete contact"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default ContactsTable;
