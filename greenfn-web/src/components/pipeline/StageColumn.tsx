/**
 * Renders a single pipeline stage column with its contact cards.
 * Acts as a droppable drop zone for dnd-kit — highlights when a card is dragged over it.
 */

import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle } from "../ui/card";
import ContactCard from "./ContactCard";
import type { PipelineStage } from "./types";

interface StageColumnProps {
  stage: PipelineStage;
}

function StageColumn({ stage }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <Card className="bg-muted/50">
        <CardHeader className="px-3 py-2.5">
          <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
            <span>{stage.name}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground ring-1 ring-border">
              {stage.contacts.length}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Drop zone — highlights with a subtle ring when a card is dragged over */}
      <div
        ref={setNodeRef}
        className={`flex min-h-16 flex-col gap-2 rounded-md transition-colors ${
          isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""
        }`}
      >
        {stage.contacts.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No contacts
          </p>
        ) : (
          stage.contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))
        )}
      </div>
    </div>
  );
}

export default StageColumn;
