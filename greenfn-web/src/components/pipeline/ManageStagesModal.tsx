/**
 * Modal for managing pipeline stages: create, rename, delete, and reorder.
 *
 * Reorder behaviour (deferred confirm):
 *   Drag rows freely using the grip handle — no API call fires on drop.
 *   A "Confirm Order" banner appears once the local order differs from the
 *   server state. Clicking Confirm sends PATCH /api/pipeline/stages/reorder.
 *   Clicking Discard reverts to the server order.
 *
 * Other mutations fire immediately:
 *   - Click a stage name → inline rename → PATCH /api/pipeline/stages/:stageId
 *   - Delete button → DELETE /api/pipeline/stages/:stageId
 *   - Add-stage input → POST /api/pipeline/stages
 *
 * When rename/delete/add triggers a parent re-fetch, the local list is merged
 * with the new server data so pending drag-reorder changes are preserved:
 *   - Stages deleted on the server are removed from the local list.
 *   - Stage names updated on the server are reflected.
 *   - Brand-new stages are appended at the end.
 *   - The locally-dragged order is otherwise kept intact.
 */

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/env";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import type { PipelineStage } from "./types";

// ── SortableStageRow ──────────────────────────────────────────────────────────

interface SortableStageRowProps {
  stage: PipelineStage;
  isBusy: boolean;
  editingId: string | null;
  editingName: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onStartEditing: (stage: PipelineStage) => void;
  onCommitRename: (stageId: string) => void;
  onEditNameChange: (name: string) => void;
  onCancelEdit: () => void;
  onDelete: (stageId: string) => void;
}

function SortableStageRow({
  stage,
  isBusy,
  editingId,
  editingName,
  renameInputRef,
  onStartEditing,
  onCommitRename,
  onEditNameChange,
  onCancelEdit,
  onDelete,
}: SortableStageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id, disabled: isBusy });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={[
        "flex items-center gap-2 rounded-md border px-2 py-1.5 bg-background transition-shadow",
        isDragging
          ? "border-primary shadow-md ring-1 ring-primary/30"
          : "border-border",
      ].join(" ")}
    >
      {/* Grip handle — only this element activates drag. */}
      <span
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </span>

      {editingId === stage.id ? (
        <Input
          ref={renameInputRef}
          value={editingName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={() => onCommitRename(stage.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename(stage.id);
            if (e.key === "Escape") onCancelEdit();
          }}
          className="h-7 flex-1 text-sm"
        />
      ) : (
        <span
          onClick={() => onStartEditing(stage)}
          className="flex-1 cursor-text select-none text-sm hover:text-foreground/80"
          title="Click to rename"
        >
          {stage.name}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        disabled={isBusy}
        onClick={() => onDelete(stage.id)}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        title="Delete stage"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

// ── ManageStagesModal ─────────────────────────────────────────────────────────

interface ManageStagesModalProps {
  open: boolean;
  stages: PipelineStage[];
  onClose: () => void;
  onStagesChanged: () => void;
}

function ManageStagesModal({
  open,
  stages,
  onClose,
  onStagesChanged,
}: ManageStagesModalProps) {
  // Local working copy. On first load (empty prev) sorts by server order.
  // On subsequent syncs (rename/delete/add) preserves local drag order while
  // patching in the latest server data.
  const [localStages, setLocalStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    setLocalStages((prev) => {
      if (prev.length === 0) {
        return [...stages].sort((a, b) => a.order - b.order);
      }

      const serverMap = new Map(stages.map((s) => [s.id, s]));

      // Keep local drag order; update names and data from server; drop deletions.
      const merged = prev
        .filter((s) => serverMap.has(s.id))
        .map((s) => ({ ...serverMap.get(s.id)!, contacts: s.contacts }));

      // Append stages that are new on the server (e.g. just added).
      const localIds = new Set(merged.map((s) => s.id));
      const incoming = stages
        .filter((s) => !localIds.has(s.id))
        .sort((a, b) => a.order - b.order);

      return [...merged, ...incoming];
    });
  }, [stages]);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Add-stage input
  const [newStageName, setNewStageName] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);

  // Shared busy flag — serialises all mutations
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  // ── Pending order detection ─────────────────────────────────────────────────
  // Compare the sequence of IDs in localStages against the server-sorted order.
  // Only meaningful when both lists have the same length (no in-flight add/delete).
  const serverOrderIds = [...stages]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);
  const localOrderIds = localStages.map((s) => s.id);
  const hasPendingOrder =
    localOrderIds.length === serverOrderIds.length &&
    localOrderIds.some((id, i) => id !== serverOrderIds[i]);

  // ── Drag ───────────────────────────────────────────────────────────────────
  // Drop only updates local state — no API call. User must confirm explicitly.

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localStages.findIndex((s) => s.id === active.id);
    const newIndex = localStages.findIndex((s) => s.id === over.id);
    if (oldIndex === newIndex) return;
    setLocalStages((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  // ── Confirm / discard order ─────────────────────────────────────────────────

  async function handleConfirmOrder() {
    const withNewOrder = localStages.map((s, index) => ({
      ...s,
      order: index,
    }));

    setIsBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pipeline/stages/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: withNewOrder.map(({ id, order }) => ({ id, order })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Failed to save stage order.",
        );
        return;
      }
      toast.success("Stage order saved.");
      onStagesChanged();
    } finally {
      setIsBusy(false);
    }
  }

  function handleDiscardOrder() {
    setLocalStages([...stages].sort((a, b) => a.order - b.order));
  }

  // ── Rename ──────────────────────────────────────────────────────────────────

  function startEditing(stage: PipelineStage) {
    if (isBusy) return;
    setEditingId(stage.id);
    setEditingName(stage.name);
  }

  async function commitRename(stageId: string) {
    const trimmed = editingName.trim();
    setEditingId(null);
    setEditingName("");
    const original = localStages.find((s) => s.id === stageId);
    if (!original || trimmed === original.name || trimmed.length === 0) return;

    setIsBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/pipeline/stages/${stageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Failed to rename stage.",
        );
        return;
      }
      setLocalStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, name: trimmed } : s)),
      );
      onStagesChanged();
    } finally {
      setIsBusy(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(stageId: string) {
    if (isBusy) return;
    if (
      !window.confirm(
        "Delete this stage? Any contacts in it will be moved to the first available stage.",
      )
    )
      return;

    setIsBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/pipeline/stages/${stageId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Failed to delete stage.",
        );
        return;
      }
      setLocalStages((prev) => prev.filter((s) => s.id !== stageId));
      toast.success("Stage deleted.");
      onStagesChanged();
    } finally {
      setIsBusy(false);
    }
  }

  // ── Add stage ───────────────────────────────────────────────────────────────

  async function handleAddStage() {
    const trimmed = newStageName.trim();
    if (!trimmed || isAddingStage) return;

    setIsAddingStage(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pipeline/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof data?.message === "string"
            ? data.message
            : "Failed to create stage.",
        );
        return;
      }
      const data: { stage: PipelineStage } = await res.json();
      setNewStageName("");
      setLocalStages((prev) => [...prev, { ...data.stage, contacts: [] }]);
      toast.success(`Stage "${trimmed}" created.`);
      onStagesChanged();
    } finally {
      setIsAddingStage(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-tight tracking-tight">
            Manage Stages
          </DialogTitle>
        </DialogHeader>

        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localStages.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {localStages.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  isBusy={isBusy}
                  editingId={editingId}
                  editingName={editingName}
                  renameInputRef={renameInputRef}
                  onStartEditing={startEditing}
                  onCommitRename={commitRename}
                  onEditNameChange={setEditingName}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setEditingName("");
                  }}
                  onDelete={handleDelete}
                />
              ))}

              {localStages.length === 0 && (
                <p className="py-4 text-center text-sm leading-6 text-muted-foreground">
                  No stages yet. Add one below.
                </p>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Pending order banner — visible only when local order differs from server */}
        {hasPendingOrder && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <span className="shrink-0 font-medium">Order changed</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardOrder}
                disabled={isBusy}
                className="h-7 text-amber-800 hover:text-amber-900 dark:text-amber-400"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmOrder}
                disabled={isBusy}
                className="h-7"
              >
                {isBusy ? "Saving..." : "Confirm Order"}
              </Button>
            </div>
          </div>
        )}

        {/* Add new stage */}
        <div className="flex gap-2 border-t pt-3">
          <Input
            placeholder="New stage name..."
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddStage();
            }}
            disabled={isAddingStage || isBusy}
          />
          <Button
            onClick={handleAddStage}
            disabled={!newStageName.trim() || isAddingStage || isBusy}
            size="sm"
          >
            {isAddingStage ? "Adding..." : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ManageStagesModal;
