/**
 * Shared domain types for the contacts feature, used across the page and all
 * contacts components.
 */

export type ContactType = "LEAD" | "CLIENT";

export interface TagItem {
  id: string;
  name: string;
}

export interface ContactItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  type: ContactType;
  birthday: string | null;
  priorities: string | null;
  portfolioSummary: string | null;
  isStarred: boolean;
  tags: TagItem[];
  updatedAt: string;
}

export interface ContactsPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ContactsResponse {
  items: ContactItem[];
  pagination: ContactsPaginationMeta;
}

export interface ContactFormState {
  fullName: string;
  phone: string;
  email: string;
  type: ContactType;
  source: string;
  birthday: string;
  priorities: string;
  portfolioSummary: string;
  tagNames: string;
  isStarred: boolean;
}

export type FormMode = "create" | "edit";
