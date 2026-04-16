// Shared types for the pipeline feature components.

type ContactType = "LEAD" | "CLIENT";

export interface PipelineContact {
  id: string;
  fullName: string;
  type: ContactType;
  source: string | null;
  stageId: string;
  openTaskCount: number;
  lastInteractionAt: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  contacts: PipelineContact[];
}