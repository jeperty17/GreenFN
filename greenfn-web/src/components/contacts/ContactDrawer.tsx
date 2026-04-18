/**
 * ContactDrawer — slide-in right panel for creating or editing a contact.
 * The form uses the HTML `form` + `id` attribute so the submit button in the
 * footer can live outside the scrollable form body.
 */
import { type SyntheticEvent } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import type {
  ContactFormState,
  ContactType,
  FormMode,
} from "../../types/contacts";

interface ContactDrawerProps {
  isOpen: boolean;
  formMode: FormMode;
  formState: ContactFormState;
  formErrorMessage: string;
  formSuccessMessage: string;
  isSubmittingForm: boolean;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onUpdateField: <K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K],
  ) => void;
}

const FORM_ID = "contact-drawer-form";

function ContactDrawer({
  isOpen,
  formMode,
  formState,
  formErrorMessage,
  formSuccessMessage,
  isSubmittingForm,
  onClose,
  onSubmit,
  onUpdateField,
}: ContactDrawerProps) {
  if (!isOpen) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) return null;

  const drawerContent = (
    <>
      {/* Overlay — closes drawer on click */}
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 z-[90] flex h-[100dvh] w-[380px] animate-in slide-in-from-right flex-col bg-card shadow-2xl duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base">
            {formMode === "create" ? "Add Contact" : "Edit Contact"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4">
            <div className="form-grid">
              <div className="field-stack">
                <Label htmlFor="contact-full-name">Full Name</Label>
                <Input
                  id="contact-full-name"
                  value={formState.fullName}
                  onChange={(e) => onUpdateField("fullName", e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="contact-type">Type</Label>
                <select
                  id="contact-type"
                  value={formState.type}
                  onChange={(e) =>
                    onUpdateField("type", e.target.value as ContactType)
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="LEAD">Lead</option>
                  <option value="CLIENT">Client</option>
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  value={formState.phone}
                  onChange={(e) => onUpdateField("phone", e.target.value)}
                  placeholder="+65…"
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formState.email}
                  onChange={(e) => onUpdateField("email", e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="contact-source">Acquisition Source</Label>
                <Input
                  id="contact-source"
                  value={formState.source}
                  onChange={(e) => onUpdateField("source", e.target.value)}
                  placeholder="Referral, cold call, social"
                />
              </div>

              <div className="field-stack">
                <Label htmlFor="contact-birthday">Birthday</Label>
                <Input
                  id="contact-birthday"
                  type="date"
                  value={formState.birthday}
                  onChange={(e) => onUpdateField("birthday", e.target.value)}
                />
              </div>
            </div>

            <div className="field-stack">
              <Label htmlFor="contact-priorities">Life Priorities</Label>
              <Textarea
                id="contact-priorities"
                value={formState.priorities}
                onChange={(e) => onUpdateField("priorities", e.target.value)}
                placeholder="Children education, retirement, legacy planning"
              />
            </div>

            <div className="field-stack">
              <Label htmlFor="contact-tags">Tags (comma-separated)</Label>
              <Input
                id="contact-tags"
                value={formState.tagNames}
                onChange={(e) => onUpdateField("tagNames", e.target.value)}
                placeholder="High Priority, Follow Up"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formState.isStarred}
                onChange={(e) => onUpdateField("isStarred", e.target.checked)}
                className="accent-primary h-4 w-4 rounded"
              />
              Mark as starred contact
            </label>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmittingForm}
            >
              {isSubmittingForm
                ? "Saving…"
                : formMode === "create"
                  ? "Save Contact"
                  : "Update Contact"}
            </Button>

            {formErrorMessage && (
              <p className="field-error">{formErrorMessage}</p>
            )}
            {formSuccessMessage && (
              <p className="field-hint text-foreground">{formSuccessMessage}</p>
            )}
          </form>
        </div>
      </div>
    </>
  );

  return createPortal(drawerContent, portalTarget);
}

export default ContactDrawer;
