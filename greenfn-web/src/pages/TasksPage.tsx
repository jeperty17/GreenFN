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
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import TaskSection from "../components/tasks/TaskSection";
import AddTaskModal from "../components/tasks/AddTaskModal";
import CalendarView from "../components/tasks/CalendarView";
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
      toast.error("Failed to mark task as done.");
      return;
    }
    removeTask(taskId);
    toast.success("Task marked as done.");
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

  async function handleReschedule(taskId: string, newDueAt: string) {
    // newDueAt is a "YYYY-MM-DD" string from the date input
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
    const updatedApiTask: Task | null = payload?.task || null;

    // Find the task in whichever bucket it currently lives in
    const task =
      overdue.find((t) => t.id === taskId) ||
      dueToday.find((t) => t.id === taskId) ||
      upcoming.find((t) => t.id === taskId);

    if (!task) return;

    removeTask(taskId);

    // Place the updated task into its new bucket (or nowhere if beyond window)
    const updatedTask: Task = updatedApiTask || { ...task, dueAt: newDueAt };
    const newBucket = categorizeDueDate(updatedTask.dueAt);

    if (newBucket === "overdue") {
      setOverdue((prev) => sortByDueAt([...prev, updatedTask]));
    } else if (newBucket === "dueToday") {
      setDueToday((prev) => [...prev, updatedTask]);
    } else if (newBucket === "upcoming") {
      setUpcoming((prev) => sortByDueAt([...prev, updatedTask]));
    }
    // null bucket (beyond window) — task is simply removed from view

    toast.success("Task rescheduled.");
  }

  return (
    <section className="page-section space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2>Tasks</h2>
          <p className="field-hint">All open next steps, grouped by urgency.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>Add Task</Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        {/* List tab — existing overdue / due today / upcoming view */}
        <TabsContent value="list">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Loading tasks…
            </p>
          ) : errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : (
            <div className="space-y-8">
              <TaskSection
                title="Overdue"
                tasks={overdue}
                urgency="overdue"
                onMarkDone={handleMarkDone}
                onReschedule={handleReschedule}
                onDelete={handleDelete}
              />
              <TaskSection
                title="Due Today"
                tasks={dueToday}
                urgency="dueToday"
                onMarkDone={handleMarkDone}
                onReschedule={handleReschedule}
                onDelete={handleDelete}
              />
              <TaskSection
                title="Upcoming"
                tasks={upcoming}
                urgency="upcoming"
                onMarkDone={handleMarkDone}
                onReschedule={handleReschedule}
                onDelete={handleDelete}
              />
            </div>
          )}
        </TabsContent>

        {/* Calendar tab — monthly DayPicker view of all OPEN tasks */}
        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>
      </Tabs>

      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchTasks();
        }}
      />
    </section>
  );
}

export default TasksPage;
