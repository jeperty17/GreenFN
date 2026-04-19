/**
 * Renders one grouped section of tasks (Overdue, Due Today, or Upcoming).
 * Uses a to-do list presentation with urgency-specific grouping and a
 * straightforward empty state.
 */

import TaskCard from "./TaskCard";
import type { Task, TaskBucket } from "./types";

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  urgency: TaskBucket;
  onMarkDone: (taskId: string) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    updates: { title: string; description: string; dueAt: string },
  ) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function TaskSection({
  title,
  tasks,
  urgency,
  onMarkDone,
  onUpdateTask,
  onDelete,
}: TaskSectionProps) {
  const headingClass =
    urgency === "overdue"
      ? "text-red-700"
      : urgency === "dueToday"
        ? "text-amber-700"
        : "text-[oklch(0.28_0.06_145)]";

  const listContainerClass =
    urgency === "overdue"
      ? "border-red-200/85 bg-red-50/70 divide-red-100"
      : urgency === "dueToday"
        ? "border-amber-200/85 bg-amber-50/70 divide-amber-100"
        : "border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.008_145)] divide-[oklch(0.9_0.01_145)]";

  const emptyStateClass =
    urgency === "overdue"
      ? "border-red-200/80 bg-red-50/60 text-red-800/90"
      : urgency === "dueToday"
        ? "border-amber-200/80 bg-amber-50/60 text-amber-800/90"
        : "border-[oklch(0.88_0.02_145)] bg-[oklch(0.988_0.006_145)] text-[oklch(0.38_0.05_145)]";

  return (
    <section className="space-y-3.5">
      <div className="flex items-center gap-2.5">
        <h3
          className={`text-sm font-semibold uppercase tracking-[0.08em] ${headingClass}`}
        >
          {title}
        </h3>
        <span className="rounded-full bg-[oklch(0.93_0.015_145)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[oklch(0.34_0.05_145)]">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed py-5 text-center text-sm ${emptyStateClass}`}
        >
          No tasks here
        </p>
      ) : (
        <div
          className={`divide-y overflow-hidden rounded-2xl border shadow-[0_10px_28px_-24px_oklch(0.3_0.04_145/0.5)] ${listContainerClass}`}
        >
          {tasks.map((task) => (
            <div
              key={task.id}
              className="px-3 py-2.5 transition-colors hover:bg-[oklch(0.985_0.01_145)] sm:px-4 sm:py-3"
            >
              <TaskCard
                task={task}
                urgency={urgency}
                onMarkDone={onMarkDone}
                onUpdateTask={onUpdateTask}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default TaskSection;
