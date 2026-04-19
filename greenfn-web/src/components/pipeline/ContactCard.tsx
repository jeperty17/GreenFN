/**
 * Draggable Kanban card for a single pipeline contact.
 * Card body: name, type badge, open task count, last interaction.
 * On hover: quick-glance tooltip to the right with essential context + View Details link.
 * isUndoing: triggers a shrink-fade exit animation before the card is removed.
 */

import { useDraggable } from "@dnd-kit/core";
import { CheckSquare, Clock, Mail, Phone, Star, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { PipelineContact } from "./types";

interface ContactCardProps {
  contact: PipelineContact;
  isUndoing?: boolean;
}

function daysSinceLabel(lastInteractionAt: string | null): string {
  if (!lastInteractionAt) return "No interaction logged";
  const days = Math.floor(
    (Date.now() - new Date(lastInteractionAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function ContactCard({ contact, isUndoing }: ContactCardProps) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
    data: { stageId: contact.stageId, contact },
  });

  return (
    // group wrapper enables the hover tooltip via group-hover utility
    <div className="group relative">
      <Card
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={[
          "cursor-grab rounded-lg border-border/80 bg-[oklch(0.995_0.004_145)] transition-all duration-300 hover:border-primary/30 hover:shadow-md active:cursor-grabbing",
          isDragging ? "opacity-30" : "",
          isUndoing ? "scale-75 opacity-0" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <CardContent className="space-y-2.5 p-3.5">
          {/* Name */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-semibold leading-tight tracking-tight text-[oklch(0.2_0.04_145)]">
              {contact.fullName}
            </p>
            {contact.isStarred ? (
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
            ) : null}
          </div>

          {/* Type badge */}
          <div>
            <Badge
              variant="outline"
              className={[
                "text-xs",
                contact.type === "CLIENT"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-sky-300/70 bg-sky-50 text-sky-900",
              ].join(" ")}
            >
              {contact.type}
            </Badge>
          </div>

          {/* Task count + last interaction */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-amber-900/85">
              <CheckSquare className="h-3 w-3" />
              {contact.openTaskCount}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-sky-900/85">
              <Clock className="h-3 w-3" />
              {daysSinceLabel(contact.lastInteractionAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Hover tooltip — appears to the right of the card; z-50 floats above board */}
      <div
        className={[
          "pointer-events-none absolute left-[calc(100%+10px)] top-0 z-50 w-72",
          "opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100",
          isDragging ? "hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="rounded-xl border border-primary/15 bg-[oklch(0.995_0.004_145)] shadow-xl">
          {/* Tooltip header */}
          <div className="border-b border-primary/15 bg-[oklch(0.97_0.014_145)] px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold leading-tight tracking-tight text-[oklch(0.2_0.04_145)]">
                  {contact.fullName}
                </p>
                <Badge
                  variant="outline"
                  className={[
                    "mt-1 text-xs",
                    contact.type === "CLIENT"
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-sky-300/70 bg-sky-50 text-sky-900",
                  ].join(" ")}
                >
                  {contact.type}
                </Badge>
              </div>
              {contact.isStarred && (
                <Star className="mt-0.5 h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
              )}
            </div>
          </div>

          {/* Tooltip info rows (quick glance only) */}
          <div className="space-y-2.5 px-4 py-3 text-sm leading-6">
            <TooltipRow
              icon={<Mail className="h-3.5 w-3.5" />}
              label={contact.email || "Email not added"}
            />
            <TooltipRow
              icon={<Phone className="h-3.5 w-3.5" />}
              label={contact.phone || "Phone not added"}
            />
            <TooltipRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label={`Last contact: ${daysSinceLabel(contact.lastInteractionAt)}`}
            />
            <TooltipRow
              icon={<Tag className="h-3.5 w-3.5" />}
              label={
                contact.tags.length > 0 ? contact.tags.join(", ") : "No tags"
              }
            />
            <TooltipRow
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label={`${contact.openTaskCount} open task${contact.openTaskCount !== 1 ? "s" : ""}`}
            />
          </div>

          {/* View details button */}
          <div className="border-t border-border px-4 py-2.5">
            <Button
              size="sm"
              variant="outline"
              className="w-full border-primary/30 text-xs text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/contacts/${contact.id}`);
              }}
            >
              Open contact details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small helper to keep tooltip rows DRY
function TooltipRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="break-words">{label}</span>
    </div>
  );
}

export default ContactCard;
