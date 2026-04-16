/**
 * Dialog for creating a new task (NextStep).
 * Fetches the contact list on open so the user can select a contact.
 * Required fields: contact, title, description, dueAt.
 * Calls POST /api/tasks on submit; invokes onSuccess so the parent can refetch.
 */

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { API_BASE_URL } from '../../config/env';
import type { ContactOption } from './types';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a task is successfully created; parent should refetch tasks. */
  onSuccess: () => void;
}

function AddTaskModal({ isOpen, onClose, onSuccess }: AddTaskModalProps) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Form field state
  const [contactId, setContactId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch contacts each time the modal opens
  useEffect(() => {
    if (!isOpen) return;

    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoadingContacts(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/contacts?page=1&pageSize=100`,
          { signal: abortController.signal },
        );
        if (!res.ok) throw new Error('Failed to load contacts');
        const data: { items: ContactOption[] } = await res.json();
        setContacts(data.items);
        // Pre-select the first contact for convenience
        if (data.items.length > 0) setContactId(data.items[0].id);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Non-fatal: the dropdown will be empty but the form is still usable
      } finally {
        setIsLoadingContacts(false);
      }
    }

    fetchContacts();
    return () => abortController.abort();
  }, [isOpen]);

  function resetForm() {
    setContactId('');
    setTitle('');
    setDescription('');
    setDueAt('');
    setErrorMessage('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!contactId || !title || !description || !dueAt) {
      setErrorMessage('All fields are required.');
      return;
    }
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (dueAt < todayStr) {
      setErrorMessage('Due date cannot be in the past.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, title, description, dueAt }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create task.');
      }

      resetForm();
      onSuccess();
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormComplete = !!contactId && !!title && !!description && !!dueAt;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact selector */}
          <div className="space-y-1.5">
            <Label htmlFor="add-task-contact">
              Contact <span className="text-destructive">*</span>
            </Label>
            {isLoadingContacts ? (
              <p className="text-sm text-muted-foreground">Loading contacts…</p>
            ) : (
              <select
                id="add-task-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="add-task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-task-title"
              placeholder="e.g. Send policy documents"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="add-task-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="add-task-description"
              placeholder="What needs to be done?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label htmlFor="add-task-due-at">
              Due Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-task-due-at"
              type="date"
              min={new Date().toLocaleDateString('en-CA')}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormComplete}
          >
            {isSubmitting ? 'Creating…' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddTaskModal;
