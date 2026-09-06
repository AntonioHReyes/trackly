import { ValidationError } from "../errors/DomainError.js";

/**
 * An amount of money in a given currency. Stored internally as integer
 * minor units (cents) to avoid floating-point drift across additions and
 * rate × hours multiplications — the concern that motivated a dedicated
 * value object instead of a raw `number`.
 */
export class Money {
  private readonly minorUnits: number;
  readonly currency: string;

  private constructor(minorUnits: number, currency: string) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  /** Builds a `Money` from a decimal amount (e.g. `12.5` → 1250 cents). */
  static fromDecimal(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw new ValidationError(`Money amount must be finite, got ${amount}`);
    }
    if (amount < 0) {
      throw new ValidationError(`Money amount cannot be negative, got ${amount}`);
    }
    const normalizedCurrency = Money.normalizeCurrency(currency);
    return new Money(Math.round(amount * 100), normalizedCurrency);
  }

  static zero(currency: string): Money {
    return new Money(0, Money.normalizeCurrency(currency));
  }

  private static normalizeCurrency(currency: string): string {
    const trimmed = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(trimmed)) {
      throw new ValidationError(`Currency must be a 3-letter ISO code, got "${currency}"`);
    }
    return trimmed;
  }

  toDecimal(): number {
    return this.minorUnits / 100;
  }

  /** Multiplies by a scalar (e.g. hourly rate × hours worked). */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new ValidationError(`Money multiplier must be a non-negative finite number`);
    }
    return new Money(Math.round(this.minorUnits * factor), this.currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError(
        `Cannot combine amounts in different currencies: ${this.currency} vs ${other.currency}`,
      );
    }
  }

  toString(): string {
    return `${this.toDecimal().toFixed(2)} ${this.currency}`;
  }
}
