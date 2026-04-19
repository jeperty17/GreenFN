/**
 * Reusable header for the Tasks page.
 * Renders the page title, helper copy, and Add Task primary action.
 */

import { Plus } from "lucide-react";
import { Button } from "../ui/button";

interface TasksHeaderProps {
  onAddTask: () => void;
}

function TasksHeader({ onAddTask }: TasksHeaderProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="space-y-1.5">
        <h1>Tasks</h1>
        <p className="field-hint max-w-[60ch] text-base leading-7">
          A simple queue of follow-ups, start with what is due now, then plan
          the rest
        </p>
      </div>

      <div className="flex items-start lg:justify-end">
        <Button className="w-full gap-2 sm:w-auto" onClick={onAddTask}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Task
        </Button>
      </div>
    </div>
  );
}

export default TasksHeader;
