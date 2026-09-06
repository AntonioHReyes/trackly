import { describe, expect, it } from "vitest";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("Workspace", () => {
  it("creates a workspace with a generated id", () => {
    const workspace = Workspace.create({ slug: "acme", name: "Acme Corp", currency: "usd" });
    expect(workspace.id).toBeTruthy();
    expect(workspace.currency).toBe("usd");
    expect(workspace.defaultHourlyRate).toBeNull();
  });

  it("rejects an invalid slug", () => {
    expect(() => Workspace.create({ slug: "Acme Corp!", name: "Acme", currency: "USD" })).toThrow(
      ValidationError,
    );
  });

  it("rejects an empty name", () => {
    expect(() => Workspace.create({ slug: "acme", name: "  ", currency: "USD" })).toThrow(
      ValidationError,
    );
  });

  it("resolves the default rate as Money", () => {
    const workspace = Workspace.create({
      slug: "acme",
      name: "Acme",
      currency: "USD",
      defaultHourlyRate: 50,
    });
    expect(workspace.resolveDefaultRate()?.toDecimal()).toBe(50);
  });

  it("has no default rate when none is set", () => {
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    expect(workspace.resolveDefaultRate()).toBeNull();
  });
});
