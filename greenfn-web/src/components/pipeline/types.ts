// Shared types for the pipeline feature components.

type ContactType = "LEAD" | "CLIENT";

export interface PipelineContact {
  id: string;
  fullName: string;
  type: ContactType;
  source: string | null;
  stageId: string;
  email: string | null;
  phone: string | null;
  isStarred: boolean;
  tags: string[];
  openTaskCount: number;
  lastInteractionAt: string | null;
  interactionCount: number;
  policyCount: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  contacts: PipelineContact[];
}
