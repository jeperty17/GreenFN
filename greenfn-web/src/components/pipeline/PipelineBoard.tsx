/**
 * Presentational Kanban board for the Leads Pipeline.
 * Renders loading, error, and populated board states.
 * The parent's scroll container owns overflow; this component only lays out columns.
 */

import StageColumn from "./StageColumn";
import type { PipelineStage } from "./types";

// Re-export so LeadsPipelinePage can import the type from here.
export type { PipelineStage };

interface PipelineBoardProps {
  stages: PipelineStage[];
  isLoading: boolean;
  errorMessage: string;
  undoingContactId: string | null;
}

function PipelineBoard({
  stages,
  isLoading,
  errorMessage,
  undoingContactId,
}: PipelineBoardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-primary/15 bg-[oklch(0.98_0.01_145)] py-16 text-base font-medium leading-7 text-primary/75">
        Loading your pipeline...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/45 bg-[oklch(0.95_0.03_25)] px-4 py-3 text-sm text-[oklch(0.42_0.14_25)]">
        {errorMessage}
      </div>
    );
  }

  return (
    // min-w-max prevents columns from shrinking inside the parent's overflow-auto container
    <div
      className="flex h-full items-start gap-5 pb-2"
      style={{ minWidth: "max-content" }}
    >
      {stages.map((stage, index) => (
        <StageColumn
          key={stage.id}
          stage={stage}
          undoingContactId={undoingContactId}
          stageIndex={index}
        />
      ))}
    </div>
  );
}

export default PipelineBoard;
