import { describe, expect, it } from "vitest";
import { Project } from "../../../src/domain/entities/Project.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("Project", () => {
  const workspace = Workspace.create({
    slug: "acme",
    name: "Acme",
    currency: "USD",
    defaultHourlyRate: 40,
  });

  it("rejects an empty name", () => {
    expect(() => Project.create({ workspaceId: workspace.id, name: " " })).toThrow(ValidationError);
  });

  it("falls back to the workspace's default rate when unset", () => {
    const project = Project.create({ workspaceId: workspace.id, name: "Website" });
    expect(project.resolveRate(workspace)?.toDecimal()).toBe(40);
  });

  it("overrides the workspace's default rate when set", () => {
    const project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 75 });
    expect(project.resolveRate(workspace)?.toDecimal()).toBe(75);
  });

  it("archive() returns an archived copy without mutating the original", () => {
    const project = Project.create({ workspaceId: workspace.id, name: "Website" });
    const archived = project.archive();
    expect(project.archived).toBe(false);
    expect(archived.archived).toBe(true);
  });

  it("withUpdates() only changes the given fields", () => {
    const project = Project.create({ workspaceId: workspace.id, name: "Website", client: "Bob" });
    const updated = project.withUpdates({ hourlyRate: 60 });
    expect(updated.name).toBe("Website");
    expect(updated.client).toBe("Bob");
    expect(updated.hourlyRate).toBe(60);
  });
});
