import { ValidationError } from "../errors/DomainError.js";

/**
 * An inclusive-start, exclusive-end span of time. Used both for filtering
 * (`list --from --to`, report shortcuts) and for a `TimeEntry`'s
 * start/end — a running entry has no end and is represented separately by
 * `TimeEntry`, not by this value object.
 */
export class DateRange {
  readonly start: Date;
  readonly end: Date;

  private constructor(start: Date, end: Date) {
    this.start = start;
    this.end = end;
  }

  static of(start: Date, end: Date): DateRange {
    if (end.getTime() <= start.getTime()) {
      throw new ValidationError(
        `DateRange end (${end.toISOString()}) must be after start (${start.toISOString()})`,
      );
    }
    return new DateRange(start, end);
  }

  contains(date: Date): boolean {
    return date.getTime() >= this.start.getTime() && date.getTime() < this.end.getTime();
  }

  durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }

  durationHours(): number {
    return this.durationMs() / (1000 * 60 * 60);
  }

  /** True if this range and `other` share at least one instant. */
  overlaps(other: DateRange): boolean {
    return this.start.getTime() < other.end.getTime() && other.start.getTime() < this.end.getTime();
  }
}
