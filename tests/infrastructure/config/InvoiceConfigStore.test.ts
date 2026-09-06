import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InvoiceConfigStore } from "../../../src/infrastructure/config/InvoiceConfigStore.js";

describe("InvoiceConfigStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function newStore(): InvoiceConfigStore {
    dir = mkdtempSync(join(tmpdir(), "trackly-invoice-config-test-"));
    return new InvoiceConfigStore(join(dir, "invoice.json"));
  }

  it("defaults to empty values and a counter starting at 1", () => {
    const values = newStore().read();
    expect(values).toEqual({
      billTo: null,
      taxRate: null,
      notes: null,
      numberTemplate: null,
      nextNumber: 1,
    });
  });

  it("persists bill-to, tax rate, and notes independently", () => {
    const store = newStore();
    store.setBillTo("Acme Corp\n123 Main St");
    store.setTaxRate(21);
    store.setNotes("Thanks for your business");
    const values = store.read();
    expect(values.billTo).toBe("Acme Corp\n123 Main St");
    expect(values.taxRate).toBe(21);
    expect(values.notes).toBe("Thanks for your business");
  });

  it("throws when generating a number with no template configured", () => {
    expect(() => newStore().nextInvoiceNumber()).toThrow(/no numbering template configured/i);
  });

  it("formats and increments the counter from a zero-padded template", () => {
    const store = newStore();
    store.setNumberTemplate("INV-2026-%03d");
    expect(store.nextInvoiceNumber()).toBe("INV-2026-001");
    expect(store.nextInvoiceNumber()).toBe("INV-2026-002");
    expect(store.read().nextNumber).toBe(3);
  });

  it("formats an unpadded counter", () => {
    const store = newStore();
    store.setNumberTemplate("INV-%d");
    expect(store.nextInvoiceNumber()).toBe("INV-1");
  });
});
