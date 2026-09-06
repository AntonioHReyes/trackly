import { describe, expect, it } from "vitest";
import { Rounding } from "../../../src/domain/value-objects/Rounding.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("Rounding", () => {
  it("leaves durations untouched when disabled", () => {
    expect(Rounding.none().applyHours(1.234)).toBeCloseTo(1.234);
    expect(Rounding.none().isEnabled).toBe(false);
  });

  it("rounds to the nearest increment, half up", () => {
    const rounding = Rounding.of("nearest", 15);
    expect(rounding.applyHours(0.1)).toBeCloseTo(0); // 6 min → 0
    expect(rounding.applyHours(0.2)).toBeCloseTo(0.25); // 12 min → 15
    expect(rounding.applyHours(0.125)).toBeCloseTo(0.25); // exactly 7.5 min → 15
  });

  it("rounds up, so any started increment is billed whole", () => {
    const rounding = Rounding.of("up", 15);
    expect(rounding.applyHours(0.02)).toBeCloseTo(0.25);
    expect(rounding.applyHours(0.25)).toBeCloseTo(0.25);
    expect(rounding.applyHours(0.26)).toBeCloseTo(0.5);
  });

  it("rounds down, discarding the partial increment", () => {
    const rounding = Rounding.of("down", 30);
    expect(rounding.applyHours(0.9)).toBeCloseTo(0.5);
    expect(rounding.applyHours(0.4)).toBeCloseTo(0);
  });

  it("never turns a zero-length entry into billable time", () => {
    expect(Rounding.of("up", 60).applyHours(0)).toBe(0);
  });

  it("rejects unusable increments", () => {
    expect(() => Rounding.of("nearest", 0)).toThrow(ValidationError);
    expect(() => Rounding.of("nearest", 2.5)).toThrow(ValidationError);
    expect(() => Rounding.of("nearest", 5000)).toThrow(ValidationError);
  });

  it("describes itself for report headers", () => {
    expect(Rounding.of("nearest", 6).describe()).toBe("nearest 6 min");
    expect(Rounding.none().describe()).toBe("off");
  });
});
