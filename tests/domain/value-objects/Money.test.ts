import { describe, expect, it } from "vitest";
import { Money } from "../../../src/domain/value-objects/Money.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("Money", () => {
  it("round-trips a decimal amount", () => {
    const money = Money.fromDecimal(12.5, "eur");
    expect(money.toDecimal()).toBe(12.5);
    expect(money.currency).toBe("EUR");
  });

  it("rejects a negative amount", () => {
    expect(() => Money.fromDecimal(-1, "USD")).toThrow(ValidationError);
  });

  it("rejects a malformed currency code", () => {
    expect(() => Money.fromDecimal(10, "euros")).toThrow(ValidationError);
  });

  it("multiplies without floating-point drift", () => {
    const rate = Money.fromDecimal(45.5, "USD");
    expect(rate.multiply(2.5).toDecimal()).toBeCloseTo(113.75, 2);
  });

  it("adds amounts in the same currency", () => {
    const a = Money.fromDecimal(10, "USD");
    const b = Money.fromDecimal(5.5, "USD");
    expect(a.add(b).toDecimal()).toBe(15.5);
  });

  it("refuses to add different currencies", () => {
    const eur = Money.fromDecimal(10, "EUR");
    const usd = Money.fromDecimal(10, "USD");
    expect(() => eur.add(usd)).toThrow(ValidationError);
  });
});
