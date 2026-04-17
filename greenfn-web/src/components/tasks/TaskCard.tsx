/**
 * Individual task card for the Tasks page.
 * Shows contact name, task title, formatted due date, and pipeline stage.
 * The urgency prop drives colour scheme: red for overdue, amber for due today, neutral for upcoming.
 * Mark Done removes the card on API success. Reschedule reveals an inline date input.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import type { Task, TaskBucket } from "./types";
import { formatTaskDate } from "./timezone";

interface TaskCardProps {
  task: Task;
  urgency: TaskBucket;
  onMarkDone: (taskId: string) => Promise<void>;
  onReschedule: (taskId: string, newDueAt: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function formatDate(isoString: string): string {
  return formatTaskDate(isoString);
}

function TaskCard({
  task,
  urgency,
  onMarkDone,
  onReschedule,
  onDelete,
}: TaskCardProps) {
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Card border/background colour by urgency
  const cardClass =
    urgency === "overdue"
      ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      : urgency === "dueToday"
        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
        : "";

  // Due date text colour by urgency
  const dateClass =
    urgency === "overdue"
      ? "text-red-600 dark:text-red-400"
      : urgency === "dueToday"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  async function handleMarkDone() {
    setIsMarkingDone(true);
    try {
      await onMarkDone(task.id);
    } finally {
      setIsMarkingDone(false);
    }
  }

  async function handleRescheduleSubmit() {
    if (!rescheduleDate) return;
    setIsRescheduling(true);
    try {
      await onReschedule(task.id, rescheduleDate);
      setShowReschedule(false);
      setRescheduleDate("");
    } finally {
      setIsRescheduling(false);
    }
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
    <Card className={cardClass}>
      <CardContent className="p-4 space-y-3">
        {/* Top row: task title + date/stage */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-snug">{task.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {task.contactName}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs font-medium ${dateClass}`}>
              {formatDate(task.dueAt)}
            </span>
            {task.stageName ? (
              <Badge variant="secondary" className="text-xs">
                {task.stageName}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Reschedule inline input or action buttons */}
        {showReschedule ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              onClick={handleRescheduleSubmit}
              disabled={isRescheduling || !rescheduleDate}
            >
              {isRescheduling ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowReschedule(false);
                setRescheduleDate("");
              }}
              disabled={isRescheduling}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isMarkingDone || isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkDone}
              disabled={isMarkingDone || isDeleting}
            >
              {isMarkingDone ? "Saving…" : "Mark Done"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReschedule(true)}
              disabled={isMarkingDone || isDeleting}
            >
              Reschedule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TaskCard;
