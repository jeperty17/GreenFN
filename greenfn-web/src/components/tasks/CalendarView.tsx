/**
 * Calendar tab view for the Tasks page.
 * Fetches all OPEN tasks from GET /api/tasks?view=calendar and renders them on a
 * monthly DayPicker grid. Day cells show coloured chips (red=overdue,
 * amber=today, blue=future). Clicking a day or chip opens a side panel with
 * full task details and mark-done / reschedule / delete actions.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import type { DayProps } from "react-day-picker";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/env";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Task } from "./types";
import {
  formatTaskDate,
  getTaskDateKey,
  getTodayTaskDateKey,
} from "./timezone";

interface CalendarApiResponse {
  tasks: Task[];
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

/** Converts a Date to a YYYY-MM-DD string used as a grouping key */
function toDateKey(date: Date): string {
  return getTaskDateKey(date);
}

/** Groups tasks into a map keyed by YYYY-MM-DD */
function groupByDate(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};
  for (const task of tasks) {
    const key = getTaskDateKey(task.dueAt);
    if (!map[key]) map[key] = [];
    map[key].push(task);
  }
  return map;
}

/** Formats a YYYY-MM-DD key as a human-readable date string */
function formatDateKey(key: string): string {
  return formatTaskDate(`${key}T00:00:00+08:00`);
}

/**
 * Returns Tailwind colour classes for a task chip based on its due date.
 * Overdue = red, due today = amber, future = primary/blue.
 */
function chipColorClass(dueAtIso: string): string {
  const todayKey = getTodayTaskDateKey();
  const taskKey = getTaskDateKey(dueAtIso);
  if (taskKey < todayKey)
    return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400";
  if (taskKey === todayKey)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400";
  return "bg-primary/10 text-primary";
}

// ─── classNames prop for DayPicker — full Tailwind styling, no external CSS ──

const rdpClassNames = {
  root: "w-full",
  months: "w-full",
  month: "w-full",
  month_caption: "relative flex h-10 items-center justify-center mb-1",
  caption_label: "text-sm font-semibold",
  nav: "absolute inset-x-0 flex items-center justify-between",
  button_previous:
    "h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
  button_next:
    "h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
  month_grid: "w-full table-fixed border-collapse",
  weekdays: "",
  weekday:
    "text-[11px] font-medium text-muted-foreground text-center pb-1.5 pt-0.5",
  weeks: "",
  week: "",
  day: "",
  day_button: "",
  chevron: "h-4 w-4 fill-current",
};

// ─── CalendarTaskRow — one task row inside the day panel ─────────────────────

interface CalendarTaskRowProps {
  task: Task;
  onMarkDone: (taskId: string) => Promise<void>;
  onReschedule: (taskId: string, newDueAt: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function CalendarTaskRow({
  task,
  onMarkDone,
  onReschedule,
  onDelete,
}: CalendarTaskRowProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleMarkDone() {
    setIsMarkingDone(true);
    try {
      await onMarkDone(task.id);
    } finally {
      setIsMarkingDone(false);
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

  return (
    <div className="border-b border-border/50 py-3 last:border-0">
      {/* Task info */}
      <div className="flex items-start gap-2 mb-2">
        {/* Urgency indicator dot */}
        <span
          className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${
            chipColorClass(task.dueAt).split(" ")[0]
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="text-xs text-muted-foreground">{task.contactName}</p>
          {task.stageName && (
            <Badge
              variant="secondary"
              className="mt-1 text-[10px] h-4 px-1.5 py-0"
            >
              {task.stageName}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      {showReschedule ? (
        <div className="flex items-center gap-1.5 pl-4">
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            onClick={handleRescheduleSubmit}
            disabled={isRescheduling || !rescheduleDate}
          >
            {isRescheduling ? "…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2"
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
        <div className="flex items-center gap-1 pl-4">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
            disabled={isMarkingDone || isDeleting}
            title="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2"
            onClick={handleMarkDone}
            disabled={isMarkingDone || isDeleting}
          >
            {isMarkingDone ? "…" : "Done"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2"
            onClick={() => setShowReschedule(true)}
            disabled={isMarkingDone || isDeleting}
          >
            Reschedule
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── DayPanel — side panel showing all tasks for a selected day ───────────────

interface DayPanelProps {
  dateKey: string;
  tasks: Task[];
  onClose: () => void;
  onMarkDone: (taskId: string) => Promise<void>;
  onReschedule: (taskId: string, newDueAt: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function DayPanel({
  dateKey,
  tasks,
  onClose,
  onMarkDone,
  onReschedule,
  onDelete,
}: DayPanelProps) {
  return (
    <div className="w-72 shrink-0 rounded-lg border border-border bg-background shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <p className="text-xs font-semibold text-foreground leading-snug">
            {formatDateKey(dateKey)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Task list */}
      <div className="px-4 overflow-y-auto max-h-[480px]">
        {tasks.length === 0 ? (
          <p className="py-6 text-xs text-muted-foreground text-center">
            No tasks on this day.
          </p>
        ) : (
          tasks.map((task) => (
            <CalendarTaskRow
              key={task.id}
              task={task}
              onMarkDone={onMarkDone}
              onReschedule={onReschedule}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── CalendarView — main export ───────────────────────────────────────────────

export default function CalendarView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [month, setMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Derived state
  const tasksByDate = useMemo(() => groupByDate(tasks), [tasks]);
  const tasksForSelectedDay = selectedDateKey
    ? (tasksByDate[selectedDateKey] ?? [])
    : [];

  // Refs for stable read access inside the memoised CustomDay component.
  // The component is created once (empty deps) but reads the latest data via refs.
  const tasksByDateRef = useRef(tasksByDate);
  tasksByDateRef.current = tasksByDate;

  const selectedDateKeyRef = useRef(selectedDateKey);
  selectedDateKeyRef.current = selectedDateKey;

  // Stable setter ref so CustomDay can toggle selection without capturing stale state
  const setSelectedDateKeyRef =
    useRef<React.Dispatch<React.SetStateAction<string | null>>>(
      setSelectedDateKey,
    );
  setSelectedDateKeyRef.current = setSelectedDateKey;

  async function fetchCalendarTasks(signal?: AbortSignal) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks?view=calendar`, {
        signal,
      });
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
      const data: CalendarApiResponse = await res.json();
      setTasks(data.tasks);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMessage((err as Error).message || "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const ac = new AbortController();
    fetchCalendarTasks(ac.signal);
    return () => ac.abort();
  }, []);

  function removeTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleMarkDone(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    if (!res.ok) {
      toast.error("Failed to mark task as done.");
      return;
    }
    removeTask(taskId);
    toast.success("Task marked as done.");
  }

  async function handleReschedule(taskId: string, newDueAt: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: newDueAt }),
    });
    if (!res.ok) {
      toast.error("Failed to reschedule task.");
      return;
    }
    const payload = await res.json().catch(() => null);
    const updatedTask: Task | null = payload?.task || null;
    // Update in local state — chip moves to the new date automatically
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, dueAt: updatedTask?.dueAt || newDueAt } : t,
      ),
    );
    toast.success("Task rescheduled.");
  }

  async function handleDelete(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete task.");
      return;
    }
    removeTask(taskId);
    toast.success("Task deleted.");
  }

  /**
   * Custom DayPicker Day component.
   * Memoised with empty deps — reads live task/selection data via refs to avoid
   * remounting every cell on every render cycle.
   */
  const CustomDay = useMemo(() => {
    function CalendarDayCell(props: DayProps) {
      const { day, modifiers, ...tdProps } = props;
      const key = toDateKey(day.date);
      const dayTasks = tasksByDateRef.current[key] || [];
      const isSelected = selectedDateKeyRef.current === key;
      const isToday = modifiers.today ?? false;
      const isOutside = modifiers.outside ?? false;

      return (
        <td
          {...tdProps}
          onClick={() =>
            setSelectedDateKeyRef.current((prev) => (prev === key ? null : key))
          }
          className={[
            "border border-border/40 align-top cursor-pointer transition-colors",
            isOutside
              ? "bg-muted/20 opacity-40 pointer-events-none"
              : "hover:bg-muted/30",
            isSelected ? "ring-1 ring-inset ring-primary/60 bg-primary/5" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="min-h-[80px] p-1.5">
            {/* Day number — highlighted circle for today */}
            <div className="mb-1 flex justify-end">
              <span
                className={[
                  "text-xs leading-none w-5 h-5 flex items-center justify-center rounded-full",
                  isToday
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {day.date.getDate()}
              </span>
            </div>

            {/* Task chips — at most 3 shown, rest collapsed into "+N more" */}
            <div className="space-y-0.5">
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  title={`${task.contactName}: ${task.title}`}
                  className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${chipColorClass(task.dueAt)}`}
                >
                  {task.contactName}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{dayTasks.length - 3} more
                </div>
              )}
            </div>
          </div>
        </td>
      );
    }
    return CalendarDayCell;
  }, []); // intentionally empty — all dynamic data is accessed via refs

  if (isLoading) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Loading calendar…
      </p>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        <DayPicker
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          classNames={rdpClassNames}
          components={{ Day: CustomDay }}
        />
      </div>

      {/* Day detail panel — appears when a day is selected */}
      {selectedDateKey && (
        <DayPanel
          dateKey={selectedDateKey}
          tasks={tasksForSelectedDay}
          onClose={() => setSelectedDateKey(null)}
          onMarkDone={handleMarkDone}
          onReschedule={handleReschedule}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
