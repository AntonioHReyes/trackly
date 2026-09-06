import { describe, expect, it } from "vitest";
import { DateRange } from "../../../src/domain/value-objects/DateRange.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("DateRange", () => {
  it("computes duration in hours", () => {
    const range = DateRange.of(new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T17:30:00Z"));
    expect(range.durationHours()).toBe(8.5);
  });

  it("rejects an end that is not after start", () => {
    const t = new Date("2026-01-01T09:00:00Z");
    expect(() => DateRange.of(t, t)).toThrow(ValidationError);
    expect(() => DateRange.of(t, new Date(t.getTime() - 1))).toThrow(ValidationError);
  });

  it("contains checks are start-inclusive, end-exclusive", () => {
    const range = DateRange.of(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-02T00:00:00Z"));
    expect(range.contains(new Date("2026-01-01T00:00:00Z"))).toBe(true);
    expect(range.contains(new Date("2026-01-02T00:00:00Z"))).toBe(false);
  });

  it("detects overlap between ranges", () => {
    const a = DateRange.of(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
    const b = DateRange.of(new Date("2026-01-02T00:00:00Z"), new Date("2026-01-04T00:00:00Z"));
    const c = DateRange.of(new Date("2026-01-05T00:00:00Z"), new Date("2026-01-06T00:00:00Z"));
    expect(a.overlaps(b)).toBe(true);
    expect(a.overlaps(c)).toBe(false);
  });
});
