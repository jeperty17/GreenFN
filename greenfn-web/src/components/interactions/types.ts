/*
 * Shared interaction-history UI types and constants used by page-level and
 * reusable interaction components.
 */

export type ContactType = "LEAD" | "CLIENT";

export type ContactItem = {
  id: string;
  fullName: string;
  type: ContactType;
  source: string | null;
};

export type InteractionType =
  | "CALL"
  | "MEETING"
  | "WHATSAPP_DM"
  | "GENERAL_NOTE";

export type InteractionLog = {
  id: string;
  contactId: string;
  type: InteractionType;
  title: string | null;
  interactionDate: string;
  notes: string;
  aiSummaryLink: {
    summaryText: string | null;
    model: string | null;
    sourceMode: string | null;
    generatedAt: string | null;
  } | null;
  relatedTask: {
    id: string;
    title: string;
  } | null;
};

export type InteractionFormState = {
  type: InteractionType;
  interactionDate: string;
  title: string;
  notes: string;
  aiSummaryDraft: string;
  aiSummaryModel: string | null;
  aiSummarySourceMode: string | null;
  aiSummaryGeneratedAt: string | null;
};

export const typeLabelMap: Record<InteractionType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  WHATSAPP_DM: "WhatsApp/DM",
  GENERAL_NOTE: "General Note",
};
