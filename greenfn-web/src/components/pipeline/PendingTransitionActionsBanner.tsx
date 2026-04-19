/**
 * Summary banner for unresolved transition actions.
 * Shows task/interaction counts and exposes a single review action callback.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface PendingTransitionActionsBannerProps {
  unresolvedTaskCount: number;
  unresolvedInteractionCount: number;
  onReviewActions: () => void;
}

function PendingTransitionActionsBanner({
  unresolvedTaskCount,
  unresolvedInteractionCount,
  onReviewActions,
}: PendingTransitionActionsBannerProps) {
  const outstandingTotal = unresolvedTaskCount + unresolvedInteractionCount;

  return (
    <Card className="shrink-0 border-amber-300/75 bg-amber-50/85 shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.01em] text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Pending transition actions
          </p>
          <p className="max-w-[64ch] text-sm leading-6 text-amber-800">
            Review {outstandingTotal} pending item
            {outstandingTotal !== 1 && "s"}: {unresolvedTaskCount} task
            {unresolvedTaskCount !== 1 && "s"} and {" "}
            {unresolvedInteractionCount} interaction
            {unresolvedInteractionCount !== 1 && "s"}
          </p>
        </div>
        <Button
          type="button"
          className="bg-amber-900 text-amber-50 hover:bg-amber-950"
          onClick={onReviewActions}
        >
          Review actions
        </Button>
      </CardContent>
    </Card>
  );
}

export default PendingTransitionActionsBanner;
