/**
 * ContactsPagination — prev/next arrows, page-number pills, and a result
 * range summary. Renders ellipsis for long page ranges.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPageNumbers } from "./contactUtils";

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface ContactsPaginationProps {
  pagination: PaginationState;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

function ContactsPagination({
  pagination,
  isLoading,
  onPageChange,
}: ContactsPaginationProps) {
  const { page, pageSize, total, totalPages, hasPreviousPage, hasNextPage } =
    pagination;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {total === 0
          ? "No results found"
          : `Showing records ${rangeStart} – ${rangeEnd} of ${total}`}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!hasPreviousPage || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="flex h-8 w-8 items-center justify-center rounded border bg-card transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers(page, totalPages).map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={p === page || isLoading}
              className={`flex h-8 w-8 items-center justify-center rounded text-xs transition-colors disabled:cursor-not-allowed ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={!hasNextPage || isLoading}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded border bg-card transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default ContactsPagination;
