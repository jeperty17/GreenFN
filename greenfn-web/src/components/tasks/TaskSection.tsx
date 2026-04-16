/**
 * Renders one grouped section of tasks (Overdue, Due Today, or Upcoming).
 * Shows a heading with a count badge and an empty-state message when there are no tasks.
 * urgency prop is forwarded to each TaskCard for colour theming.
 */

import TaskCard from "./TaskCard";
import type { Task, TaskBucket } from "./types";

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  urgency: TaskBucket;
  onMarkDone: (taskId: string) => Promise<void>;
  onReschedule: (taskId: string, newDueAt: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function TaskSection({
  title,
  tasks,
  urgency,
  onMarkDone,
  onReschedule,
  onDelete,
}: TaskSectionProps) {
  // Section heading colour matches the urgency theme
  const headingClass =
    urgency === "overdue"
      ? "text-red-600 dark:text-red-400"
      : urgency === "dueToday"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className={`text-base font-semibold ${headingClass}`}>{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          No tasks here.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              urgency={urgency}
              onMarkDone={onMarkDone}
              onReschedule={onReschedule}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TaskSection;
