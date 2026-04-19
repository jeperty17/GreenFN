/**
 * Renders a single pipeline stage column with its contact cards.
 * Acts as a droppable drop zone for dnd-kit — highlights when a card is dragged over it.
 * Passes undoingContactId down to ContactCard to trigger the undo exit animation.
 */

import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle } from "../ui/card";
import ContactCard from "./ContactCard";
import type { PipelineStage } from "./types";

interface StageColumnProps {
  stage: PipelineStage;
  undoingContactId: string | null;
  stageIndex: number;
}

function stageTone(index: number) {
  const tones = [
    {
      over: "bg-primary/10 ring-1 ring-primary/30",
    },
    {
      over: "bg-sky-100/70 ring-1 ring-sky-300",
    },
    {
      over: "bg-amber-100/70 ring-1 ring-amber-300",
    },
  ] as const;

  return tones[index % tones.length];
}

function StageColumn({
  stage,
  undoingContactId,
  stageIndex,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const tone = stageTone(stageIndex);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3.5">
      <Card className="border-primary/20 bg-[oklch(0.965_0.02_145)] shadow-sm">
        <CardHeader className="px-3.5 py-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base font-semibold leading-tight tracking-tight text-black">
            <span>{stage.name}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary ring-1 ring-primary/25">
              {stage.contacts.length}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Drop zone — highlights with a subtle ring when a card is dragged over */}
      <div
        ref={setNodeRef}
        className={`flex min-h-20 flex-col gap-2.5 rounded-lg p-0.5 transition-colors ${
          isOver ? tone.over : ""
        }`}
      >
        {stage.contacts.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-5 text-center text-sm leading-6 text-muted-foreground">
            Drop contacts here to move them
          </p>
        ) : (
          stage.contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isUndoing={undoingContactId === contact.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default StageColumn;
