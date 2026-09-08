import type { Command } from "commander";
import { DateRange } from "../../domain/value-objects/DateRange.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import {
  describeDateRangeShortcut,
  resolveDateRangeShortcut,
  type DateRangeShortcut,
} from "../../application/services/DateRangeShortcuts.js";

export interface DateRangeCliOptions {
  today?: boolean;
  yesterday?: boolean;
  thisWeek?: boolean;
  lastWeek?: boolean;
  thisMonth?: boolean;
  lastMonth?: boolean;
  last7Days?: boolean;
  last30Days?: boolean;
  thisYear?: boolean;
  lastYear?: boolean;
  from?: string;
  to?: string;
}

/** A resolved range plus the human label describing how it was chosen. */
export interface DateRangeSelection {
  range: DateRange | undefined;
  /** `undefined` when no shortcut was used, so callers can fall back to raw dates. */
  label: string | undefined;
  /** Which shortcut produced this range, so callers can derive its counterpart. */
  shortcut: DateRangeShortcut | undefined;
}

/** Adds the shared `--today|--yesterday|...|--from/--to` flags to a command. */
export function addDateRangeOptions(command: Command): Command {
  return command
    .option("--today", "shortcut: today")
    .option("--yesterday", "shortcut: yesterday")
    .option("--this-week", "shortcut: current week (honors config week-start)")
    .option("--last-week", "shortcut: previous week")
    .option("--this-month", "shortcut: current calendar month (1st to last day)")
    .option("--last-month", "shortcut: previous calendar month")
    .option("--last-7-days", "shortcut: rolling 7 days ending today")
    .option("--last-30-days", "shortcut: rolling 30 days ending today")
    .option("--this-year", "shortcut: current calendar year")
    .option("--last-year", "shortcut: previous calendar year")
    .option("--from <datetime>", "range start (ISO datetime), used with --to")
    .option("--to <datetime>", "range end (ISO datetime), used with --from");
}

const SHORTCUT_BY_FLAG: Array<[keyof DateRangeCliOptions, DateRangeShortcut]> = [
  ["today", "today"],
  ["yesterday", "yesterday"],
  ["thisWeek", "this-week"],
  ["lastWeek", "last-week"],
  ["thisMonth", "this-month"],
  ["lastMonth", "last-month"],
  ["last7Days", "last-7-days"],
  ["last30Days", "last-30-days"],
  ["thisYear", "this-year"],
  ["lastYear", "last-year"],
];

/** Turns parsed CLI flags into a range plus its label ("Last month", ...). */
export function resolveDateRangeSelection(
  options: DateRangeCliOptions,
  weekStart: WeekStart,
): DateRangeSelection {
  const shortcut = SHORTCUT_BY_FLAG.find(([flag]) => options[flag])?.[1];
  if (shortcut) {
    return {
      range: resolveDateRangeShortcut(shortcut, weekStart),
      label: describeDateRangeShortcut(shortcut),
      shortcut,
    };
  }
  if (options.from && options.to) {
    return {
      range: DateRange.of(new Date(options.from), new Date(options.to)),
      label: undefined,
      shortcut: undefined,
    };
  }
  return { range: undefined, label: undefined, shortcut: undefined };
}

/** Turns parsed CLI flags into a `DateRange`, or `undefined` for "no filter". */
export function resolveDateRangeFromOptions(
  options: DateRangeCliOptions,
  weekStart: WeekStart,
): DateRange | undefined {
  return resolveDateRangeSelection(options, weekStart).range;
}
