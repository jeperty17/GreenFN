/**
 * Reusable metrics strip for the Tasks page.
 * Shows key task counts with consistent card styling and color semantics.
 */

type MetricTone = "action" | "overdue" | "today" | "upcoming";

interface MetricCardProps {
  label: string;
  value: number;
  tone: MetricTone;
}

interface TasksMetricsGridProps {
  dueNowCount: number;
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
}

function MetricCard({ label, value, tone }: MetricCardProps) {
  const toneClassMap: Record<
    MetricTone,
    { cardClass: string; labelClass: string; valueClass: string }
  > = {
    action: {
      cardClass: "border-[oklch(0.78_0.06_145)] bg-[oklch(0.94_0.04_145)]",
      labelClass: "text-[oklch(0.37_0.09_145)]",
      valueClass: "text-[oklch(0.23_0.05_145)]",
    },
    overdue: {
      cardClass: "border-red-200/85 bg-red-50/80",
      labelClass: "text-red-700",
      valueClass: "text-red-800",
    },
    today: {
      cardClass: "border-amber-200/85 bg-amber-50/80",
      labelClass: "text-amber-700",
      valueClass: "text-amber-800",
    },
    upcoming: {
      cardClass: "border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.008_145)]",
      labelClass: "text-[oklch(0.42_0.09_145)]",
      valueClass: "text-[oklch(0.24_0.04_145)]",
    },
  };
  const toneClasses = toneClassMap[tone];

  return (
    <div
      className={`flex flex-col rounded-xl border px-3.5 py-2.5 ${toneClasses.cardClass}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.08em] ${toneClasses.labelClass}`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${toneClasses.valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function TasksMetricsGrid({
  dueNowCount,
  overdueCount,
  dueTodayCount,
  upcomingCount,
}: TasksMetricsGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Needs Action" value={dueNowCount} tone="action" />
      <MetricCard label="Overdue" value={overdueCount} tone="overdue" />
      <MetricCard label="Due Today" value={dueTodayCount} tone="today" />
      <MetricCard label="Upcoming" value={upcomingCount} tone="upcoming" />
    </div>
  );
}

export default TasksMetricsGrid;
