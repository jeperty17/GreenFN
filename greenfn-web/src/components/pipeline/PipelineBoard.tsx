/**
 * Presentational Kanban board for the Leads Pipeline.
 * Handles loading, error, and populated board states.
 * Delegates column rendering to StageColumn.
 */

import StageColumn from "./StageColumn";
import type { PipelineStage } from "./types";

// Re-export so LeadsPipelinePage can import the type from here.
export type { PipelineStage };

interface PipelineBoardProps {
  stages: PipelineStage[];
  isLoading: boolean;
  errorMessage: string;
}

function PipelineBoard({ stages, isLoading, errorMessage }: PipelineBoardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        Loading pipeline...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: "max-content" }}>
        {stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} />
        ))}
      </div>
    </div>
  );
}

export default PipelineBoard;