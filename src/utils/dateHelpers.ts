const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayISO(): string {
  return toISODate(new Date());
}

export function formatDateLabel(value?: string | null): string {
  if (!value) {
    return "Not set";
  }

  const date = parseISODate(value);
  return date ? DATE_FORMATTER.format(date) : "Invalid date";
}

export function formatMonthLabel(date: Date): string {
  return MONTH_FORMATTER.format(date);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function getMonthKey(value: Date | string): string {
  const date = typeof value === "string" ? parseISODate(value) : value;

  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

export function compareISODate(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isOnOrBeforeToday(value: string, today = new Date()): boolean {
  const date = parseISODate(value);

  if (!date) {
    return false;
  }

  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return date.getTime() <= todayOnly.getTime();
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function dateForDueDay(monthDate: Date, dueDay: number): Date {
  const safeDay = Math.min(
    Math.max(Math.floor(dueDay), 1),
    daysInMonth(monthDate.getFullYear(), monthDate.getMonth())
  );

  return new Date(monthDate.getFullYear(), monthDate.getMonth(), safeDay);
}

export function latestISODate(values: string[]): string | null {
  const validValues = values.filter((value) => parseISODate(value));

  if (validValues.length === 0) {
    return null;
  }

  return [...validValues].sort(compareISODate).at(-1) ?? null;
}
