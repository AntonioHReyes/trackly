import { DateRange } from "../../domain/value-objects/DateRange.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";

export type DateRangeShortcut =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-7-days"
  | "last-30-days"
  | "this-year"
  | "last-year";

/** Title-cased names used in report headers, e.g. `Last month`. */
const SHORTCUT_TITLES: Record<DateRangeShortcut, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week",
  "last-week": "Last week",
  "this-month": "This month",
  "last-month": "Last month",
  "last-7-days": "Last 7 days",
  "last-30-days": "Last 30 days",
  "this-year": "This year",
  "last-year": "Last year",
};

export function describeDateRangeShortcut(shortcut: DateRangeShortcut): string {
  return SHORTCUT_TITLES[shortcut];
}

/**
 * Resolves a report/list shortcut (`--today`, `--this-week`, ...) into a
 * concrete `DateRange`, honoring the configurable week start (see SPEC.md's
 * `config set week-start`). Calendar shortcuts snap to natural boundaries
 * (a month runs from the 1st to the last day, a week from the configured
 * first weekday), while the rolling `last-N-days` ones count back from
 * today. All math is in local time, matching how a CLI user thinks about
 * "today".
 */
export function resolveDateRangeShortcut(
  shortcut: DateRangeShortcut,
  weekStart: WeekStart,
  now: Date = new Date(),
): DateRange {
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);
  switch (shortcut) {
    case "today":
      return DateRange.of(startOfToday, startOfTomorrow);
    case "yesterday":
      return DateRange.of(addDays(startOfToday, -1), startOfToday);
    case "this-week": {
      const start = startOfWeek(now, weekStart);
      return DateRange.of(start, addDays(start, 7));
    }
    case "last-week": {
      const start = addDays(startOfWeek(now, weekStart), -7);
      return DateRange.of(start, addDays(start, 7));
    }
    case "this-month": {
      const start = startOfMonth(now);
      return DateRange.of(start, addMonths(start, 1));
    }
    case "last-month": {
      const start = addMonths(startOfMonth(now), -1);
      return DateRange.of(start, startOfMonth(now));
    }
    // Rolling windows include today, so "last 7 days" is today plus the six
    // days before it — not the seven days ending yesterday.
    case "last-7-days":
      return DateRange.of(addDays(startOfToday, -6), startOfTomorrow);
    case "last-30-days":
      return DateRange.of(addDays(startOfToday, -29), startOfTomorrow);
    case "this-year": {
      const start = startOfYear(now);
      return DateRange.of(start, addYears(start, 1));
    }
    case "last-year": {
      const start = addYears(startOfYear(now), -1);
      return DateRange.of(start, startOfYear(now));
    }
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}

function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const start = startOfDay(date);
  const day = start.getDay(); // 0 = Sunday ... 6 = Saturday
  const offset = weekStart === "monday" ? (day === 0 ? 6 : day - 1) : day;
  return addDays(start, -offset);
}
