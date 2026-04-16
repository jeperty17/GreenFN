/**
 * Shared TypeScript interfaces for the Tasks feature.
 */

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueAt: string; // ISO date string from the API
  status: string;
  contactId: string;
  contactName: string;
  stageName: string | null;
}

export interface ContactOption {
  id: string;
  fullName: string;
}

export type TaskBucket = 'overdue' | 'dueToday' | 'upcoming';
