/**
 * Dialog for creating a new task (NextStep).
 * Fetches the contact list on open so the user can select a contact.
 * Required fields: contact, title, dueAt.
 * Calls POST /api/tasks on submit; invokes onSuccess so the parent can refetch.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { API_BASE_URL } from "../../config/env";
import type { ContactOption } from "./types";
import { getTodayTaskDateKey } from "./timezone";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a task is successfully created; parent should refetch tasks. */
  onSuccess: () => void;
  /** Optional preselected contact id (used by resolve flows). */
  initialContactId?: string;
  /** Optional preselected contact name (used by resolve flows). */
  initialContactName?: string;
  /** When true, prevents changing the contact selection. */
  lockContactSelection?: boolean;
  /** Optional due date value in yyyy-mm-dd format. */
  initialDueAt?: string;
  /** Allow submitting a date earlier than today (for historical resolve flows). */
  allowPastDueDate?: boolean;
}

function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  initialContactId,
  initialContactName,
  lockContactSelection = false,
  initialDueAt,
  allowPastDueDate = false,
}: AddTaskModalProps) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Form field state
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [contentBounds, setContentBounds] = useState({ left: 0, right: 0 });

  // Fetch contacts each time the modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (lockContactSelection && initialContactId) {
      setContacts(
        initialContactName
          ? [{ id: initialContactId, fullName: initialContactName }]
          : [],
      );
      setContactId(initialContactId);
      return;
    }

    const abortController = new AbortController();

    async function fetchContacts() {
      setIsLoadingContacts(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/contacts?page=1&pageSize=100`,
          { signal: abortController.signal },
        );
        if (!res.ok) throw new Error("Failed to load contacts");
        const data = await res.json();
        setContacts(data.items);
        // Pre-select the first contact for convenience
        if (data.items.length > 0) setContactId(data.items[0].id);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // Non-fatal: the dropdown will be empty but the form is still usable
      } finally {
        setIsLoadingContacts(false);
      }
    }

    fetchContacts();
    return () => abortController.abort();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDueAt(initialDueAt || "");
  }, [initialDueAt, isOpen]);

  useEffect(() => {
    const mainElement = document.querySelector("main");

    function updateContentBounds() {
      if (!mainElement) {
        setContentBounds({ left: 0, right: 0 });
        return;
      }

      const rect = mainElement.getBoundingClientRect();
      setContentBounds({
        left: Math.max(0, rect.left),
        right: Math.max(0, window.innerWidth - rect.right),
      });
    }

    const resizeObserver = mainElement
      ? new ResizeObserver(updateContentBounds)
      : null;

    if (mainElement && resizeObserver) {
      resizeObserver.observe(mainElement);
    }

    updateContentBounds();
    window.addEventListener("resize", updateContentBounds);

    return () => {
      window.removeEventListener("resize", updateContentBounds);
      resizeObserver?.disconnect();
    };
  }, []);

  function resetForm() {
    setContactId("");
    setTitle("");
    setDescription("");
    setDueAt("");
    setErrorMessage("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!contactId || !title || !dueAt) {
      setErrorMessage("All fields are required");
      return;
    }
    const todayStr = getTodayTaskDateKey();
    if (!allowPastDueDate && dueAt < todayStr) {
      setErrorMessage("Due date cannot be in the past");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          title,
          description: description.trim(),
          dueAt,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create task");
      }

      resetForm();
      onSuccess();
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormComplete = !!contactId && !!title && !!dueAt;

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!isOpen || !portalTarget) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[oklch(0.18_0.01_145/0.45)]"
        onClick={handleClose}
      />

      <div
        className="absolute inset-y-0 flex items-center justify-center p-4"
        style={{ left: contentBounds.left, right: contentBounds.right }}
      >
        <div className="flex max-h-[88dvh] w-full min-w-0 max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] shadow-[0_14px_36px_-24px_oklch(0.24_0.03_145/0.45)]">
          <div className="flex items-center justify-between rounded-t-2xl border-b border-[oklch(0.88_0.02_145)] bg-[oklch(0.965_0.025_145)] px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(0.4_0.1_145)]">
                Add activity
              </p>
              <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">
                Add New Task
              </h3>
              <p className="mt-2 max-w-[60ch] text-base leading-7 text-muted-foreground">
                Create a follow-up task for a contact
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-out hover:bg-[oklch(0.94_0.015_145)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2"
              onClick={handleClose}
              aria-label="Close"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <div className="space-y-1.5">
              <Label htmlFor="add-task-contact">
                Contact <span className="text-destructive">*</span>
              </Label>
              {isLoadingContacts ? (
                <p className="text-sm text-muted-foreground">
                  Loading contacts…
                </p>
              ) : (
                <select
                  id="add-task-contact"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  disabled={lockContactSelection}
                  className="w-full rounded-md border bg-background px-3 py-2 text-base"
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

            <div className="space-y-1.5">
              <Label htmlFor="add-task-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-task-title"
                placeholder="Summarise the task in a few words"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-description">
                Description (Optional)
              </Label>
              <Textarea
                id="add-task-description"
                placeholder="What needs to be done?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-due-at">
                Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-task-due-at"
                type="date"
                min={allowPastDueDate ? undefined : getTodayTaskDateKey()}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t pt-5">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormComplete}
              >
                {isSubmitting ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalTarget);
}

export default AddTaskModal;
