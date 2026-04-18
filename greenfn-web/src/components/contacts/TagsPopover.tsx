/**
 * TagsPopover — a self-contained popover anchored to a "Manage Tags" trigger
 * that lists all global tags, allows deleting them, and creating new ones.
 * Click-outside closes the popover automatically.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { TagItem } from "../../types/contacts";

interface TagsPopoverProps {
  availableTags: TagItem[];
  newTagName: string;
  isCreatingTag: boolean;
  tagErrorMessage: string;
  onNewTagNameChange: (value: string) => void;
  onCreateTag: () => void;
  onDeleteTag: (tagId: string) => void;
}

function TagsPopover({
  availableTags,
  newTagName,
  isCreatingTag,
  tagErrorMessage,
  onNewTagNameChange,
  onCreateTag,
  onDeleteTag,
}: TagsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Close on click outside the popover container. */
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative ml-auto" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Manage Tags
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border bg-card p-4 shadow-lg">
          <p className="mb-3 text-sm font-semibold">Tags</p>

          <div className="mb-3 max-h-48 overflow-y-auto space-y-0.5">
            {availableTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags yet. Create one below.
              </p>
            ) : (
              availableTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted"
                >
                  <span className="text-sm">{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteTag(tag.id)}
                    className="ml-2 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    title="Delete tag"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 border-t pt-3">
            <Input
              value={newTagName}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreateTag()}
              placeholder="New tag name"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={onCreateTag}
              disabled={isCreatingTag}
            >
              {isCreatingTag ? "Adding…" : "Add"}
            </Button>
          </div>

          {tagErrorMessage && (
            <p className="mt-2 text-xs text-destructive">{tagErrorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TagsPopover;
