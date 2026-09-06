import { describe, expect, it } from "vitest";
import { InvoiceDetails } from "../../../src/domain/value-objects/InvoiceDetails.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("InvoiceDetails", () => {
  it("applies defaults: today's issue date, no due date, 0% tax", () => {
    const details = InvoiceDetails.create({ number: "INV-1" });
    expect(details.number).toBe("INV-1");
    expect(details.dueDate).toBeNull();
    expect(details.taxRate).toBe(0);
    expect(details.billTo).toBeNull();
    expect(details.notes).toBeNull();
  });

  it("trims blank bill-to and notes down to null", () => {
    const details = InvoiceDetails.create({ number: "INV-1", billTo: "   ", notes: "  " });
    expect(details.billTo).toBeNull();
    expect(details.notes).toBeNull();
  });

  it("rejects an empty invoice number", () => {
    expect(() => InvoiceDetails.create({ number: "  " })).toThrow(ValidationError);
  });

  it("rejects a due date before the issue date", () => {
    expect(() =>
      InvoiceDetails.create({
        number: "INV-1",
        issueDate: new Date("2026-02-01"),
        dueDate: new Date("2026-01-01"),
      }),
    ).toThrow(ValidationError);
  });

  it("rejects a tax rate outside 0-100", () => {
    expect(() => InvoiceDetails.create({ number: "INV-1", taxRate: -1 })).toThrow(ValidationError);
    expect(() => InvoiceDetails.create({ number: "INV-1", taxRate: 101 })).toThrow(ValidationError);
  });
});
