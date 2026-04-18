/**
 * ContactsFilterBar — horizontal filter row sitting above the contacts table.
 * Houses the search input, type/source/tag dropdowns, a clear-filters button,
 * and the Manage Tags popover.
 */
import { Search, X } from "lucide-react";
import { Input } from "../ui/input";
import TagsPopover from "./TagsPopover";
import type { TagItem } from "../../types/contacts";

interface ContactsFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchApply: () => void;
  type: string;
  onTypeChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  /* Tag management */
  availableTags: TagItem[];
  newTagName: string;
  isCreatingTag: boolean;
  tagErrorMessage: string;
  onNewTagNameChange: (value: string) => void;
  onCreateTag: () => void;
  onDeleteTag: (tagId: string) => void;
  /* Filter state */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function ContactsFilterBar({
  searchInput,
  onSearchInputChange,
  onSearchApply,
  type,
  onTypeChange,
  source,
  onSourceChange,
  tagFilter,
  onTagFilterChange,
  availableTags,
  newTagName,
  isCreatingTag,
  tagErrorMessage,
  onNewTagNameChange,
  onCreateTag,
  onDeleteTag,
  hasActiveFilters,
  onClearFilters,
}: ContactsFilterBarProps) {
  /* Shared class for native selects — matches Input height/border styling */
  const selectCls =
    "h-8 rounded-md border bg-background px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
        hasActiveFilters ? "border-primary/30 bg-secondary/25" : "bg-card"
      }`}
    >
      {/* Search — grows to fill available space, applies on Enter */}
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchApply()}
          placeholder="Search contacts…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Divider — visually separates search from narrow filter controls */}
      <span className="h-5 w-px shrink-0 bg-border" />

      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          className={selectCls}
        >
          <option value="">All types</option>
          <option value="LEAD">Lead</option>
          <option value="CLIENT">Client</option>
        </select>

        {/* Tag filter — dropdown from available tags */}
        <select
          value={tagFilter}
          onChange={(e) => onTagFilterChange(e.target.value)}
          className={selectCls + " w-28"}
        >
          <option value="">All tags</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>

        <Input
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          placeholder="Source"
          className="h-8 w-28 text-sm"
        />
      </div>

      {/* Clear filters — only visible when a filter is active */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          title="Clear all filters"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      <TagsPopover
        availableTags={availableTags}
        newTagName={newTagName}
        isCreatingTag={isCreatingTag}
        tagErrorMessage={tagErrorMessage}
        onNewTagNameChange={onNewTagNameChange}
        onCreateTag={onCreateTag}
        onDeleteTag={onDeleteTag}
      />
    </div>
  );
}

export default ContactsFilterBar;
