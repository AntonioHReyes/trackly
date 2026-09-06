import { ValidationError } from "../errors/DomainError.js";

/**
 * How a duration is snapped to the rounding increment, as in
 * report rounding: `nearest` (half-up), `up` (always the next increment) or
 * `down` (truncate). `none` disables rounding entirely.
 */
export type RoundingMode = "none" | "nearest" | "up" | "down";

export const ROUNDING_MODES: readonly RoundingMode[] = ["none", "nearest", "up", "down"];

const MINUTES_IN_DAY = 24 * 60;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Rounds tracked durations to a fixed increment before they are aggregated
 * into a report (see SPEC.md's Reports command). Rounding is a reporting
 * concern only: stored entries always keep their exact start/end timestamps,
 * so switching the setting re-renders the same data differently instead of
 * rewriting history.
 */
export class Rounding {
  private constructor(
    readonly mode: RoundingMode,
    /** Increment in minutes; meaningless (and fixed at 1) when `mode` is `none`. */
    readonly minutes: number,
  ) {}

  /** The identity rounding — durations pass through untouched. */
  static none(): Rounding {
    return new Rounding("none", 1);
  }

  static of(mode: RoundingMode, minutes: number): Rounding {
    if (!ROUNDING_MODES.includes(mode)) {
      throw new ValidationError(
        `Rounding mode must be one of ${ROUNDING_MODES.join(", ")}, got "${mode}"`,
      );
    }
    if (mode === "none") return Rounding.none();
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MINUTES_IN_DAY) {
      throw new ValidationError(
        `Rounding increment must be a whole number of minutes between 1 and ${MINUTES_IN_DAY}, got ${minutes}`,
      );
    }
    return new Rounding(mode, minutes);
  }

  get isEnabled(): boolean {
    return this.mode !== "none";
  }

  /** Snaps a duration in milliseconds to the configured increment. */
  applyMs(ms: number): number {
    if (!this.isEnabled || ms <= 0) return Math.max(0, ms);
    const increment = this.minutes * MS_PER_MINUTE;
    const units = ms / increment;
    switch (this.mode) {
      case "up":
        return Math.ceil(units) * increment;
      case "down":
        return Math.floor(units) * increment;
      default:
        return Math.round(units) * increment;
    }
  }

  applyHours(hours: number): number {
    return this.applyMs(hours * 3600_000) / 3600_000;
  }

  /** Human-readable form for report headers, e.g. `nearest 15 min`. */
  describe(): string {
    return this.isEnabled ? `${this.mode} ${this.minutes} min` : "off";
  }
}
