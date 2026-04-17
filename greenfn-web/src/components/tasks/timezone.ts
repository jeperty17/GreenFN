export const TASK_TIME_ZONE = "Asia/Singapore";

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function getTaskDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return formatDateKeyInTimeZone(date, TASK_TIME_ZONE);
}

export function getTodayTaskDateKey(): string {
  return getTaskDateKey(new Date());
}

export function formatTaskDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TASK_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
