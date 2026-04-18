/*
 * InteractionDetailsModal presents a compact, focused interaction detail view
 * directly in context from the timeline without page navigation.
 */

import { Sparkles, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { InteractionLog } from "./types";

interface InteractionDetailsModalProps {
  isOpen: boolean;
  interaction: InteractionLog | null;
  contactName: string;
  onClose: () => void;
  formatDateTime: (value: string) => string;
}

function resolveTypeLabel(type: InteractionLog["type"]) {
  if (type === "CALL") return "Call";
  if (type === "MEETING") return "Meeting";
  if (type === "WHATSAPP_DM") return "WhatsApp/DM";
  return "General Note";
}

function resolveTypeTone(type: InteractionLog["type"]) {
  if (type === "CALL") {
    return {
      headerBg: "bg-[oklch(0.965_0.02_245)]",
      headerText: "text-[oklch(0.36_0.11_245)]",
      chip: "bg-[oklch(0.96_0.018_245)] text-[oklch(0.36_0.11_245)] border-[oklch(0.86_0.02_245)]",
    };
  }

  if (type === "MEETING") {
    return {
      headerBg: "bg-[oklch(0.97_0.022_80)]",
      headerText: "text-[oklch(0.42_0.09_80)]",
      chip: "bg-[oklch(0.97_0.022_80)] text-[oklch(0.42_0.09_80)] border-[oklch(0.86_0.02_80)]",
    };
  }

  if (type === "WHATSAPP_DM") {
    return {
      headerBg: "bg-[oklch(0.965_0.02_155)]",
      headerText: "text-[oklch(0.34_0.09_155)]",
      chip: "bg-[oklch(0.965_0.02_155)] text-[oklch(0.34_0.09_155)] border-[oklch(0.86_0.02_155)]",
    };
  }

  return {
    headerBg: "bg-[oklch(0.97_0.008_235)]",
    headerText: "text-[oklch(0.34_0.04_235)]",
    chip: "bg-[oklch(0.97_0.008_235)] text-[oklch(0.34_0.04_235)] border-[oklch(0.88_0.01_235)]",
  };
}

function InteractionDetailsModal({
  isOpen,
  interaction,
  contactName,
  onClose,
  formatDateTime,
}: InteractionDetailsModalProps) {
  if (!isOpen || !interaction) return null;

  const [contentBounds, setContentBounds] = useState({ left: 0, right: 0 });

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

  const tone = resolveTypeTone(interaction.type);
  const summaryText = interaction.aiSummaryLink?.summaryText?.trim() || "";
  const contentText = summaryText || interaction.notes || "No notes recorded";
  const isSummary = Boolean(summaryText);

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[oklch(0.18_0.01_145/0.45)]"
        onClick={onClose}
      />

      <div
        className="absolute inset-y-0 flex items-center justify-center p-4"
        style={{ left: contentBounds.left, right: contentBounds.right }}
      >
        <div className="flex h-[70dvh] w-[70%] min-h-[420px] min-w-0 max-w-[980px] flex-col overflow-hidden rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.995_0.004_145)] shadow-[0_14px_36px_-24px_oklch(0.24_0.03_145/0.45)] max-md:h-[70dvh] max-md:w-full">
          <div
            className={[
              "flex items-start justify-between gap-4 border-b border-[oklch(0.88_0.02_145)] px-6 py-5",
              tone.headerBg,
            ].join(" ")}
          >
            <div className="space-y-2">
              <p
                className={[
                  "text-[11px] font-semibold uppercase tracking-[0.16em]",
                  tone.headerText,
                ].join(" ")}
              >
                Interaction details
              </p>
              <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
                {resolveTypeLabel(interaction.type)}
              </h3>
              {interaction.title && (
                <p className="text-base font-medium text-foreground/90">
                  {interaction.title}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{contactName}</span>
                <span aria-hidden="true">•</span>
                <span className="tabular-nums">
                  {formatDateTime(interaction.interactionDate)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 ease-out hover:bg-[oklch(0.94_0.015_145)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                {isSummary ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  <StickyNote className="h-3.5 w-3.5" />
                )}
                {isSummary ? "AI summary" : "Interaction notes"}
              </div>

              <div
                className={["rounded-xl border p-4 md:p-5", tone.chip].join(
                  " ",
                )}
              >
                <p className="whitespace-pre-wrap text-base leading-7 text-foreground">
                  {contentText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalTarget);
}

export default InteractionDetailsModal;
