/**
 * Dialog that lists unresolved transition actions and routes users
 * to either task creation or interaction logging for a selected contact.
 */

import { AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export interface PendingTransitionActionItem {
  id: string;
  fullName: string;
  stageName: string | null;
  stageUpdatedAt: string;
}

interface PendingTransitionActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unresolvedTasks: PendingTransitionActionItem[];
  unresolvedInteractions: PendingTransitionActionItem[];
  formatDateTimeLabel: (value: string) => string;
  onCreateTask: (item: PendingTransitionActionItem) => void;
  onLogInteraction: (item: PendingTransitionActionItem) => void;
}

function PendingTransitionActionsDialog({
  open,
  onOpenChange,
  unresolvedTasks,
  unresolvedInteractions,
  formatDateTimeLabel,
  onCreateTask,
  onLogInteraction,
}: PendingTransitionActionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pending transition actions</DialogTitle>
          <DialogDescription>
            Review and complete tasks and interactions from recent stage moves
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto">
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Tasks to create ({unresolvedTasks.length})
            </p>
            {unresolvedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks pending</p>
            ) : (
              unresolvedTasks.map((item) => (
                <div
                  key={`task-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-amber-200/90 bg-amber-50/75 p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.fullName}</p>
                    <p className="text-xs text-amber-900/75">
                      Stage: {item.stageName || "Unknown"} · Transitioned{" "}
                      {formatDateTimeLabel(item.stageUpdatedAt)}
                    </p>
                  </div>
                  <Button type="button" onClick={() => onCreateTask(item)}>
                    Create task
                  </Button>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-900">
              <MessageSquare className="h-4 w-4" />
              Interactions to log ({unresolvedInteractions.length})
            </p>
            {unresolvedInteractions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No interactions pending
              </p>
            ) : (
              unresolvedInteractions.map((item) => (
                <div
                  key={`interaction-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-sky-200/90 bg-sky-50/80 p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{item.fullName}</p>
                    <p className="text-xs text-sky-900/80">
                      Stage: {item.stageName || "Unknown"} · Transitioned{" "}
                      {formatDateTimeLabel(item.stageUpdatedAt)}
                    </p>
                  </div>
                  <Button type="button" onClick={() => onLogInteraction(item)}>
                    Log interaction
                  </Button>
                </div>
              ))
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PendingTransitionActionsDialog;
