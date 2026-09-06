import { describe, expect, it } from "vitest";
import { resolveRounding } from "../../src/cli/commands/roundingOptions.js";
import { Rounding } from "../../src/domain/value-objects/Rounding.js";
import { ValidationError } from "../../src/domain/errors/DomainError.js";
import type { ConfigValues } from "../../src/infrastructure/config/ConfigStore.js";

function config(rounding: Rounding): ConfigValues {
  return { dbPath: undefined, weekStart: "monday", rounding };
}

describe("resolveRounding", () => {
  it("falls back to the stored config when no flag is given", () => {
    const resolved = resolveRounding({}, config(Rounding.of("down", 6)));
    expect(resolved.describe()).toBe("down 6 min");
  });

  it("lets flags override the config for a one-off report", () => {
    const resolved = resolveRounding(
      { rounding: "up", roundingMinutes: "30" },
      config(Rounding.of("down", 6)),
    );
    expect(resolved.describe()).toBe("up 30 min");
  });

  it("assumes nearest when only an increment is passed", () => {
    const resolved = resolveRounding({ roundingMinutes: "10" }, config(Rounding.none()));
    expect(resolved.describe()).toBe("nearest 10 min");
  });

  it("keeps the configured increment when only the mode is passed", () => {
    const resolved = resolveRounding({ rounding: "nearest" }, config(Rounding.of("up", 6)));
    expect(resolved.describe()).toBe("nearest 6 min");
  });

  it("rejects unknown modes and non-integer increments", () => {
    expect(() => resolveRounding({ rounding: "ceil" }, config(Rounding.none()))).toThrow(
      ValidationError,
    );
    expect(() => resolveRounding({ roundingMinutes: "7.5" }, config(Rounding.none()))).toThrow(
      ValidationError,
    );
  });
});
