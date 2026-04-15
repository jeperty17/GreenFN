/**
 * Renders a single contact as a draggable Kanban card.
 * Shows type badge, source, open task count, and days since last interaction.
 * Uses dnd-kit's useDraggable — becomes semi-transparent while being dragged
 * (the DragOverlay in LeadsPipelinePage renders the floating clone).
 */

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import type { PipelineContact } from "./types";

interface ContactCardProps {
  contact: PipelineContact;
}

// Returns a human-readable label for the time since the last interaction.
function daysSinceLabel(lastInteractionAt: string | null): string {
  if (!lastInteractionAt) return "No contact";
  const days = Math.floor(
    (Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function ContactCard({ contact }: ContactCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    // pass contact data so onDragEnd can access it without a lookup
    data: { stageId: contact.stageId, contact },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab transition-shadow hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <CardContent className="space-y-2 p-3">
        <p className="text-sm font-medium leading-snug">{contact.fullName}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={contact.type === "CLIENT" ? "default" : "secondary"}>
            {contact.type}
          </Badge>
          {contact.source ? (
            <span className="text-xs text-muted-foreground">{contact.source}</span>
          ) : null}
        </div>
        {/* Task count and last interaction badges */}
        <div className="flex flex-wrap items-center gap-2">
          {contact.openTaskCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
              {contact.openTaskCount} task{contact.openTaskCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
            {daysSinceLabel(contact.lastInteractionAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ContactCard;
