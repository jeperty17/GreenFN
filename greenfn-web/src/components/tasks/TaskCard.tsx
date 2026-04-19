/**
 * Individual task row for the Tasks page.
 * Uses a compact to-do list layout with a clear primary completion action,
 * concise metadata, and inline editing for date/title/description.
 */

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Task, TaskBucket } from "./types";
import { formatTaskDate, getTaskDateKey } from "./timezone";

interface TaskCardProps {
  task: Task;
  urgency: TaskBucket;
  onMarkDone: (taskId: string) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    updates: { title: string; description: string; dueAt: string },
  ) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function formatDate(isoString: string): string {
  return formatTaskDate(isoString);
}

function TaskCard({
  task,
  urgency,
  onMarkDone,
  onUpdateTask,
  onDelete,
}: TaskCardProps) {
  const normalizedDescription = task.description?.trim() ?? "";
  const hasVisibleDescription =
    Boolean(normalizedDescription) &&
    normalizedDescription !== "-" &&
    normalizedDescription !== "—";

  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(
    hasVisibleDescription ? normalizedDescription : "",
  );
  const [editDueAt, setEditDueAt] = useState(getTaskDateKey(task.dueAt));
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dateClass =
    urgency === "overdue"
      ? "text-red-700"
      : urgency === "dueToday"
        ? "text-amber-700"
        : "text-[oklch(0.35_0.07_145)]";

  const doneButtonClass =
    "border-[oklch(0.5_0.14_145)] bg-[oklch(0.5_0.14_145)] text-[oklch(0.99_0.004_145)] hover:bg-[oklch(0.44_0.15_145)]";

  async function handleMarkDone() {
    setIsMarkingDone(true);
    try {
      await onMarkDone(task.id);
    } finally {
      setIsMarkingDone(false);
    }
  }

  async function handleSaveEdit() {
    if (!editTitle.trim() || !editDescription.trim() || !editDueAt) {
      setEditError("Title, description, and due date are required");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");
    try {
      await onUpdateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        dueAt: editDueAt,
      });
      setIsEditing(false);
    } finally {
      setIsSavingEdit(false);
    }
  }

  function handleStartEdit() {
    setEditTitle(task.title);
    setEditDescription(hasVisibleDescription ? normalizedDescription : "");
    setEditDueAt(getTaskDateKey(task.dueAt));
    setEditError("");
    setIsEditing(true);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3 rounded-xl p-1.5 transition duration-200 ease-out hover:bg-[oklch(0.98_0.01_145)]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleMarkDone}
          disabled={isMarkingDone || isDeleting}
          className={`mt-0.5 h-7 w-7 shrink-0 rounded-full border transition-transform duration-200 ease-out hover:scale-[1.04] ${doneButtonClass}`}
          title="Mark task as done"
          aria-label="Mark task as done"
        >
          {isMarkingDone ? (
            <span className="text-xs">…</span>
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold leading-6 tracking-[-0.01em] text-[oklch(0.2_0.04_145)]">
            {task.title}
          </p>
          {hasVisibleDescription ? (
            <p className="line-clamp-2 text-sm leading-6 text-[oklch(0.36_0.04_145)]">
              {normalizedDescription}
            </p>
          ) : null}
          <p className="truncate text-sm font-medium leading-6 text-[oklch(0.24_0.04_145)]">
            {task.contactName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-medium leading-6 ${dateClass}`}>
              {formatDate(task.dueAt)}
            </span>
            {task.stageName ? (
              <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                {task.stageName}
              </Badge>
            ) : null}
          </div>
        </div>

        {!isEditing ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStartEdit}
              disabled={isMarkingDone || isDeleting}
              className="h-7 px-2 text-sm font-medium text-[oklch(0.36_0.06_145)] hover:bg-[oklch(0.95_0.01_145)] hover:text-[oklch(0.3_0.08_145)]"
              title="Edit task"
              aria-label="Edit task"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isMarkingDone || isDeleting}
              className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Delete task"
              aria-label="Delete task"
            >
              {isDeleting ? (
                <span className="text-xs">…</span>
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2 pl-10">
          <div className="space-y-1">
            <label
              htmlFor={`task-edit-title-${task.id}`}
              className="text-sm font-medium text-[oklch(0.34_0.05_145)]"
            >
              Task Name
            </label>
          </div>
          <input
            id={`task-edit-title-${task.id}`}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Task title"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="space-y-1">
            <label
              htmlFor={`task-edit-description-${task.id}`}
              className="text-sm font-medium text-[oklch(0.34_0.05_145)]"
            >
              Task Description
            </label>
          </div>
          <textarea
            id={`task-edit-description-${task.id}`}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Task description"
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label
                htmlFor={`task-edit-dueAt-${task.id}`}
                className="text-sm font-medium text-[oklch(0.34_0.05_145)]"
              >
                Due Date
              </label>
              <input
                id={`task-edit-dueAt-${task.id}`}
                type="date"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="mt-5 h-8"
            >
              {isSavingEdit ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setEditError("");
              }}
              disabled={isSavingEdit}
              className="mt-5 h-8"
            >
              Cancel
            </Button>
          </div>
          {editError ? (
            <p className="text-sm text-red-700">{editError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default TaskCard;
