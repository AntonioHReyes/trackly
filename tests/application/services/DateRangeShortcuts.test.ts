import { describe, expect, it } from "vitest";
import {
  describeDateRangeShortcut,
  precedingRange,
  previousDateRangeShortcut,
  resolveDateRangeShortcut,
  trailingMonths,
} from "../../../src/application/services/DateRangeShortcuts.js";
import { DateRange } from "../../../src/domain/value-objects/DateRange.js";

// A fixed Wednesday, chosen so week/month boundaries are unambiguous.
const WEDNESDAY = new Date(2026, 0, 7, 15, 30); // 2026-01-07 (Wed)

describe("resolveDateRangeShortcut", () => {
  it("today spans the current calendar day", () => {
    const range = resolveDateRangeShortcut("today", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 7));
    expect(range.end).toEqual(new Date(2026, 0, 8));
  });

  it("yesterday spans the previous calendar day", () => {
    const range = resolveDateRangeShortcut("yesterday", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 6));
    expect(range.end).toEqual(new Date(2026, 0, 7));
  });

  it("this-week starts on Monday when configured", () => {
    const range = resolveDateRangeShortcut("this-week", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 5)); // Monday
    expect(range.end).toEqual(new Date(2026, 0, 12));
  });

  it("this-week starts on Sunday when configured", () => {
    const range = resolveDateRangeShortcut("this-week", "sunday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 4)); // Sunday
    expect(range.end).toEqual(new Date(2026, 0, 11));
  });

  it("last-week is the 7 days before this-week", () => {
    const range = resolveDateRangeShortcut("last-week", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2025, 11, 29));
    expect(range.end).toEqual(new Date(2026, 0, 5));
  });

  it("this-month spans the current calendar month", () => {
    const range = resolveDateRangeShortcut("this-month", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2026, 1, 1));
  });

  it("last-month spans the previous calendar month", () => {
    const range = resolveDateRangeShortcut("last-month", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2025, 11, 1));
    expect(range.end).toEqual(new Date(2026, 0, 1));
  });

  it("last-7-days is a rolling window that includes today", () => {
    const range = resolveDateRangeShortcut("last-7-days", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2026, 0, 8));
  });

  it("last-30-days is a rolling window that includes today", () => {
    const range = resolveDateRangeShortcut("last-30-days", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2025, 11, 9));
    expect(range.end).toEqual(new Date(2026, 0, 8));
  });

  it("this-year spans the current calendar year", () => {
    const range = resolveDateRangeShortcut("this-year", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2027, 0, 1));
  });

  it("last-year spans the previous calendar year", () => {
    const range = resolveDateRangeShortcut("last-year", "monday", WEDNESDAY);
    expect(range.start).toEqual(new Date(2025, 0, 1));
    expect(range.end).toEqual(new Date(2026, 0, 1));
  });
});

describe("describeDateRangeShortcut", () => {
  it("gives each shortcut a title for report headers", () => {
    expect(describeDateRangeShortcut("last-month")).toBe("Last month");
    expect(describeDateRangeShortcut("last-7-days")).toBe("Last 7 days");
  });
});

describe("previousDateRangeShortcut", () => {
  it("pairs each calendar shortcut with its counterpart", () => {
    expect(previousDateRangeShortcut("today")).toBe("yesterday");
    expect(previousDateRangeShortcut("this-week")).toBe("last-week");
    expect(previousDateRangeShortcut("this-month")).toBe("last-month");
    expect(previousDateRangeShortcut("this-year")).toBe("last-year");
  });

  it("has no counterpart for rolling or already-past windows", () => {
    expect(previousDateRangeShortcut("last-7-days")).toBeUndefined();
    expect(previousDateRangeShortcut("yesterday")).toBeUndefined();
  });
});

describe("precedingRange", () => {
  it("returns the window of equal length ending where the range starts", () => {
    const range = DateRange.of(new Date(2026, 0, 8), new Date(2026, 0, 15));
    const previous = precedingRange(range);
    expect(previous.start).toEqual(new Date(2026, 0, 1));
    expect(previous.end).toEqual(new Date(2026, 0, 8));
  });
});

describe("trailingMonths", () => {
  it("returns the last N calendar months, oldest first, ending with the current one", () => {
    const months = trailingMonths(3, WEDNESDAY); // 2026-01-07
    expect(months.map((m) => m.start)).toEqual([
      new Date(2025, 10, 1),
      new Date(2025, 11, 1),
      new Date(2026, 0, 1),
    ]);
    expect(months[2]?.end).toEqual(new Date(2026, 1, 1));
  });
});
