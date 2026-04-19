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
  month:
    "grid w-full grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] items-center gap-y-2",
  month_caption:
    "col-start-2 row-start-1 mb-0 flex h-10 items-center justify-center",
  caption_label: "text-sm font-semibold text-[oklch(0.24_0.04_145)]",
  nav: "flex items-center gap-2",
  button_previous:
    "col-start-1 row-start-1 flex h-8 w-8 items-center justify-center justify-self-start rounded-md border border-[oklch(0.86_0.02_145)] bg-[oklch(0.99_0.004_145)] text-[oklch(0.32_0.04_145)] shadow-sm transition-colors hover:bg-[oklch(0.965_0.012_145)] hover:text-[oklch(0.22_0.05_145)]",
  button_next:
    "col-start-3 row-start-1 flex h-8 w-8 items-center justify-center justify-self-end rounded-md border border-[oklch(0.86_0.02_145)] bg-[oklch(0.99_0.004_145)] text-[oklch(0.32_0.04_145)] shadow-sm transition-colors hover:bg-[oklch(0.965_0.012_145)] hover:text-[oklch(0.22_0.05_145)]",
  month_grid:
    "col-span-3 row-start-2 w-full table-fixed border-separate border-spacing-0",
  weekdays: "",
  weekday:
    "pb-2 pt-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[oklch(0.45_0.03_145)]",
  weeks: "",
  week: "",
  day: "",
  day_button: "",
  chevron: "h-4 w-4 stroke-[2.5]",
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
          <p className="text-sm font-semibold leading-6">{task.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {task.contactName}
          </p>
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
            className="h-7 px-2 text-sm"
            onClick={handleRescheduleSubmit}
            disabled={isRescheduling || !rescheduleDate}
          >
            {isRescheduling ? "…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-sm"
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
            className="h-6 px-2 text-sm"
            onClick={handleMarkDone}
            disabled={isMarkingDone || isDeleting}
          >
            {isMarkingDone ? "…" : "Done"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-sm"
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
    <div className="overflow-hidden rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] shadow-[0_14px_32px_-24px_oklch(0.28_0.04_145/0.45)] xl:sticky xl:top-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[oklch(0.88_0.02_145)] bg-[oklch(0.97_0.02_145)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold leading-6 text-foreground">
            {formatDateKey(dateKey)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
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
      <div className="max-h-[420px] overflow-y-auto px-4">
        {tasks.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">
            No tasks on this day
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
      toast.error("Failed to mark task as done");
      return;
    }
    removeTask(taskId);
    toast.success("Task marked as done");
  }

  async function handleReschedule(taskId: string, newDueAt: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: newDueAt }),
    });
    if (!res.ok) {
      toast.error("Failed to reschedule task");
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
    toast.success("Task rescheduled");
  }

  async function handleDelete(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete task");
      return;
    }
    removeTask(taskId);
    toast.success("Task deleted");
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.99_0.006_145)] px-3 py-2">
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[oklch(0.37_0.09_145)]">
          Calendar Legend
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-sm text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Overdue
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-sm text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Due Today
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Upcoming
        </span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Calendar grid */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] p-3 sm:p-4">
          <DayPicker
            month={month}
            onMonthChange={setMonth}
            navLayout="around"
            showOutsideDays
            classNames={rdpClassNames}
            components={{ Day: CustomDay }}
          />
        </div>

        {/* Day detail panel — appears when a day is selected */}
        {selectedDateKey ? (
          <DayPanel
            dateKey={selectedDateKey}
            tasks={tasksForSelectedDay}
            onClose={() => setSelectedDateKey(null)}
            onMarkDone={handleMarkDone}
            onReschedule={handleReschedule}
            onDelete={handleDelete}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[oklch(0.86_0.02_145)] bg-[oklch(0.992_0.005_145)] px-4 py-5 text-sm text-[oklch(0.42_0.04_145)]">
            Select a date on the calendar to view and manage tasks
          </div>
        )}
      </div>
    </div>
  );
}
