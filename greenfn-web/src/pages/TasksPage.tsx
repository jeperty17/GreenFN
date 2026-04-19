/**
 * Tasks page — central task management view.
 * Two tabs: "List" (overdue / due today / upcoming sections) and "Calendar"
 * (monthly DayPicker view of all OPEN tasks).
 * Fetches all open NextSteps from GET /api/tasks and renders three sections:
 * Overdue (red), Due Today (amber), Upcoming (neutral).
 * Supports marking tasks as done, rescheduling, and adding new tasks.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/env";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import TaskSection from "../components/tasks/TaskSection";
import AddTaskModal from "../components/tasks/AddTaskModal";
import CalendarView from "../components/tasks/CalendarView";
import TasksHeader from "../components/tasks/TasksHeader";
import TasksMetricsGrid from "../components/tasks/TasksMetricsGrid";
import type { Task, TaskBucket } from "../components/tasks/types";
import {
  getTaskDateKey,
  getTodayTaskDateKey,
} from "../components/tasks/timezone";

interface TasksApiResponse {
  overdue: Task[];
  dueToday: Task[];
  upcoming: Task[];
}

/**
 * Determines which display bucket a dueAt string belongs to.
 * Returns null when the date falls beyond the 7-day upcoming window.
 */
function categorizeDueDate(dueAt: string): TaskBucket | null {
  const todayKey = getTodayTaskDateKey();
  const dueDateKey = getTaskDateKey(dueAt);

  if (dueDateKey < todayKey) return "overdue";
  if (dueDateKey === todayKey) return "dueToday";
  return "upcoming";
}

function sortByDueAt(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
}

function TasksPage() {
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [dueToday, setDueToday] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const dueNowCount = overdue.length + dueToday.length;

  async function fetchTasks(signal?: AbortSignal) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, { signal });
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
      const data: TasksApiResponse = await res.json();
      setOverdue(data.overdue);
      setDueToday(data.dueToday);
      setUpcoming(data.upcoming);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMessage((err as Error).message || "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const abortController = new AbortController();
    fetchTasks(abortController.signal);
    return () => abortController.abort();
  }, []);

  // Removes a task id from whichever bucket currently holds it
  function removeTask(taskId: string) {
    setOverdue((prev) => prev.filter((t) => t.id !== taskId));
    setDueToday((prev) => prev.filter((t) => t.id !== taskId));
    setUpcoming((prev) => prev.filter((t) => t.id !== taskId));
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

  async function handleUpdateTask(
    taskId: string,
    updates: { title: string; description: string; dueAt: string },
  ) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dueAt: updates.dueAt,
        title: updates.title,
        description: updates.description,
      }),
    });
    if (!res.ok) {
      toast.error("Failed to update task");
      return;
    }

    const payload = await res.json().catch(() => null);
    const updatedApiTask: Task | null = payload?.task || null;

    // Find the task in whichever bucket it currently lives in
    const task =
      overdue.find((t) => t.id === taskId) ||
      dueToday.find((t) => t.id === taskId) ||
      upcoming.find((t) => t.id === taskId);

    if (!task) return;

    removeTask(taskId);

    // Place the updated task into its new bucket (or nowhere if beyond window)
    const updatedTask: Task = updatedApiTask || {
      ...task,
      dueAt: updates.dueAt,
      title: updates.title,
      description: updates.description,
    };
    const newBucket = categorizeDueDate(updatedTask.dueAt);

    if (newBucket === "overdue") {
      setOverdue((prev) => sortByDueAt([...prev, updatedTask]));
    } else if (newBucket === "dueToday") {
      setDueToday((prev) => [...prev, updatedTask]);
    } else if (newBucket === "upcoming") {
      setUpcoming((prev) => sortByDueAt([...prev, updatedTask]));
    }
    // null bucket (beyond window) — task is simply removed from view

    toast.success("Task updated");
  }

  return (
    <>
      <TasksHeader onAddTask={() => setIsAddModalOpen(true)} />

      <section className="mt-5 space-y-10 lg:mt-6">
        <TasksMetricsGrid
          dueNowCount={dueNowCount}
          overdueCount={overdue.length}
          dueTodayCount={dueToday.length}
          upcomingCount={upcoming.length}
        />

        <Tabs defaultValue="list" className="space-y-5">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {isLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Loading tasks…
              </p>
            ) : errorMessage ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : (
              <>
                <section className="space-y-4 rounded-2xl border border-[oklch(0.89_0.015_145)] bg-[oklch(0.992_0.004_145)] p-5">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[oklch(0.26_0.04_145)]">
                      Needs Attention
                    </h3>
                    <p className="text-base leading-7 text-muted-foreground">
                      {dueNowCount === 0
                        ? "No urgent tasks right now"
                        : `${dueNowCount} task${dueNowCount === 1 ? "" : "s"} require attention now`}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <TaskSection
                      title="Overdue"
                      tasks={overdue}
                      urgency="overdue"
                      onMarkDone={handleMarkDone}
                      onUpdateTask={handleUpdateTask}
                      onDelete={handleDelete}
                    />
                    <TaskSection
                      title="Due Today"
                      tasks={dueToday}
                      urgency="dueToday"
                      onMarkDone={handleMarkDone}
                      onUpdateTask={handleUpdateTask}
                      onDelete={handleDelete}
                    />
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-[oklch(0.89_0.015_145)] bg-[oklch(0.995_0.004_145)] p-5">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[oklch(0.26_0.04_145)]">
                      Planned Next
                    </h3>
                    <p className="text-base leading-7 text-muted-foreground">
                      Upcoming tasks, so your week stays on track
                    </p>
                  </div>

                  <TaskSection
                    title="Upcoming"
                    tasks={upcoming}
                    urgency="upcoming"
                    onMarkDone={handleMarkDone}
                    onUpdateTask={handleUpdateTask}
                    onDelete={handleDelete}
                  />
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarView />
          </TabsContent>
        </Tabs>
      </section>

      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchTasks();
        }}
      />
    </>
  );
}

export default TasksPage;
