/*
 * Timeline card for Interaction History: filters and grouped chronological
 * entries. Receives prepared data so it can be reused across pages.
 */

import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import type { InteractionLog, InteractionType } from "./types";
import { typeLabelMap } from "./types";

type TypePill = {
  key: "ALL" | InteractionType;
  label: string;
  count: number;
};

type TimelineGroup = {
  month: string;
  items: InteractionLog[];
};

interface InteractionTimelineCardProps {
  interactionsError: string;
  isLoadingInteractions: boolean;
  filteredTimelineItemsCount: number;
  typePills: TypePill[];
  typeFilter: "ALL" | InteractionType;
  startDateFilter: string;
  endDateFilter: string;
  notesSearchFilter: string;
  timelineGroups: TimelineGroup[];
  onSetTypeFilter: (value: "ALL" | InteractionType) => void;
  onSetStartDateFilter: (value: string) => void;
  onSetEndDateFilter: (value: string) => void;
  onSetNotesSearchFilter: (value: string) => void;
  onResetFilters: () => void;
  formatDateTime: (value: string) => string;
  onOpenInteraction: (interactionId: string) => void;
}

interface TruncatedNotesPreviewProps {
  notes: string;
  onViewMore: () => void;
}

function TruncatedNotesPreview({
  notes,
  onViewMore,
}: TruncatedNotesPreviewProps) {
  const previewRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    function checkOverflow() {
      const element = previewRef.current;
      if (!element) return;

      setIsOverflowing(element.scrollHeight > element.clientHeight + 1);
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(checkOverflow)
        : null;

    if (previewRef.current && resizeObserver) {
      resizeObserver.observe(previewRef.current);
    }

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => {
      window.removeEventListener("resize", checkOverflow);
      resizeObserver?.disconnect();
    };
  }, [notes]);

  return (
    <>
      <p
        ref={previewRef}
        className="max-w-[72ch] text-base leading-7"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {notes}
      </p>

      {isOverflowing && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11"
          onClick={onViewMore}
        >
          View more
        </Button>
      )}
    </>
  );
}

function InteractionTimelineCard({
  interactionsError,
  isLoadingInteractions,
  filteredTimelineItemsCount,
  typePills,
  typeFilter,
  startDateFilter,
  endDateFilter,
  notesSearchFilter,
  timelineGroups,
  onSetTypeFilter,
  onSetStartDateFilter,
  onSetEndDateFilter,
  onSetNotesSearchFilter,
  onResetFilters,
  formatDateTime,
  onOpenInteraction,
}: InteractionTimelineCardProps) {
  const typePillPalette: Record<TypePill["key"], string> = {
    ALL: "border-[oklch(0.88_0.018_145)] bg-[oklch(0.97_0.015_145)] text-[oklch(0.34_0.09_145)]",
    CALL: "border-[oklch(0.88_0.02_245)] bg-[oklch(0.97_0.018_245)] text-[oklch(0.36_0.11_245)]",
    MEETING:
      "border-[oklch(0.88_0.02_80)] bg-[oklch(0.97_0.022_80)] text-[oklch(0.42_0.09_80)]",
    WHATSAPP_DM:
      "border-[oklch(0.88_0.02_155)] bg-[oklch(0.97_0.02_155)] text-[oklch(0.34_0.09_155)]",
    GENERAL_NOTE:
      "border-[oklch(0.88_0.01_235)] bg-[oklch(0.97_0.008_235)] text-[oklch(0.34_0.04_235)]",
  };

  const timelineTypeStyle: Record<InteractionType, string> = {
    CALL: "border-[oklch(0.86_0.02_245)] bg-[oklch(0.97_0.018_245)] text-[oklch(0.36_0.11_245)]",
    MEETING:
      "border-[oklch(0.86_0.02_80)] bg-[oklch(0.97_0.022_80)] text-[oklch(0.42_0.09_80)]",
    WHATSAPP_DM:
      "border-[oklch(0.86_0.02_155)] bg-[oklch(0.97_0.02_155)] text-[oklch(0.34_0.09_155)]",
    GENERAL_NOTE:
      "border-[oklch(0.88_0.01_235)] bg-[oklch(0.97_0.008_235)] text-[oklch(0.34_0.04_235)]",
  };

  return (
    <Card className="border-[oklch(0.89_0.018_145)] bg-[oklch(0.995_0.004_145)]">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-lg tracking-tight">
          Chronological Timeline
        </CardTitle>
        <CardDescription>
          Latest interactions appear first Use filters and search to narrow to a
          specific interaction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-xl border border-[oklch(0.89_0.016_145)] bg-[oklch(0.972_0.012_145)] p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </p>
            {typePills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => onSetTypeFilter(pill.key)}
                className={[
                  "min-h-11 rounded-full border px-3 py-1.5 text-base font-medium leading-6 transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2",
                  typeFilter === pill.key
                    ? "border-[oklch(0.44_0.15_145)] bg-[oklch(0.5_0.14_145)] text-[oklch(0.985_0.004_145)]"
                    : `${typePillPalette[pill.key]} hover:brightness-[0.98]`,
                ].join(" ")}
                aria-pressed={typeFilter === pill.key}
              >
                {pill.label} {pill.count}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[oklch(0.89_0.014_145)] pt-4 md:grid-cols-12 md:items-end">
            <div className="md:col-span-12 lg:col-span-6">
              <Input
                value={notesSearchFilter}
                onChange={(event) => onSetNotesSearchFilter(event.target.value)}
                placeholder="Search notes"
              />
            </div>

            <div className="space-y-1 md:col-span-6 lg:col-span-2">
              <label
                htmlFor="timelineStartDate"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                After
              </label>
              <Input
                id="timelineStartDate"
                type="date"
                value={startDateFilter}
                onChange={(event) => onSetStartDateFilter(event.target.value)}
              />
            </div>

            <div className="space-y-1 md:col-span-6 lg:col-span-2">
              <label
                htmlFor="timelineEndDate"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Before
              </label>
              <Input
                id="timelineEndDate"
                type="date"
                value={endDateFilter}
                onChange={(event) => onSetEndDateFilter(event.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="min-h-11 font-medium md:col-span-12 md:w-fit lg:col-span-2 lg:justify-self-end"
              onClick={onResetFilters}
            >
              Reset
            </Button>
          </div>
        </div>

        {interactionsError && (
          <p className="text-base leading-7 text-destructive">
            Error: {interactionsError}
          </p>
        )}

        {!interactionsError && isLoadingInteractions ? (
          <p className="text-base leading-7 text-muted-foreground">
            Loading interactions
          </p>
        ) : filteredTimelineItemsCount === 0 ? (
          <p className="text-base leading-7 text-muted-foreground">
            No interaction logs match the selected filters
          </p>
        ) : (
          <div className="space-y-7">
            {timelineGroups.map((group) => (
              <section key={group.month} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="rounded-full bg-[oklch(0.95_0.02_145)] px-2.5 py-1 text-[11px] font-semibold tracking-widest text-[oklch(0.36_0.08_145)]">
                    {group.month}
                  </h3>
                  <div className="h-px flex-1 bg-[oklch(0.88_0.01_145)]" />
                  <p className="text-xs font-medium tabular-nums text-muted-foreground">
                    {group.items.length} interactions
                  </p>
                </div>

                <ul className="relative ml-2 border-l border-[oklch(0.88_0.012_145)] pl-5 md:ml-3 md:pl-6">
                  {group.items.map((entry) => (
                    <li key={entry.id} className="relative pb-5 last:pb-0">
                      <span
                        className={[
                          "absolute -left-[31px] top-2 h-3 w-3 rounded-full border bg-[oklch(0.995_0.004_145)]",
                          timelineTypeStyle[entry.type].split(" ")[0],
                        ].join(" ")}
                      />
                      <div
                        className="w-full cursor-pointer rounded-xl border border-[oklch(0.9_0.01_145)] bg-[oklch(0.995_0.004_145)] p-4 transition-colors duration-200 ease-out hover:bg-[oklch(0.988_0.008_145)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2 md:p-5"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenInteraction(entry.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenInteraction(entry.id);
                          }
                        }}
                        aria-label={`Open interaction details for ${entry.title || typeLabelMap[entry.type]}`}
                      >
                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={timelineTypeStyle[entry.type]}
                          >
                            {typeLabelMap[entry.type]}
                          </Badge>
                          <p className="text-sm font-medium tabular-nums text-muted-foreground">
                            {formatDateTime(entry.interactionDate)}
                          </p>
                        </div>
                        {entry.title && (
                          <p className="mb-2 text-base font-semibold leading-6 text-foreground">
                            {entry.title}
                          </p>
                        )}

                        {entry.aiSummaryLink?.summaryText ? (
                          <Button
                            type="button"
                            variant="outline"
                            className={`mt-1 min-h-11 hover:brightness-[0.98] ${timelineTypeStyle[entry.type]}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenInteraction(entry.id);
                            }}
                            aria-label={`View AI summary for ${entry.title || typeLabelMap[entry.type]}`}
                          >
                            View AI summary
                          </Button>
                        ) : (
                          <TruncatedNotesPreview
                            notes={entry.notes}
                            onViewMore={() => onOpenInteraction(entry.id)}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InteractionTimelineCard;
