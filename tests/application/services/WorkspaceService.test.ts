import { describe, expect, it, beforeEach } from "vitest";
import { WorkspaceService } from "../../../src/application/services/WorkspaceService.js";
import { InMemoryWorkspaceRepository } from "../../support/fakes/InMemoryWorkspaceRepository.js";
import { InMemoryActiveWorkspaceStore } from "../../support/fakes/InMemoryActiveWorkspaceStore.js";
import { ConflictError, NotFoundError } from "../../../src/domain/errors/DomainError.js";

describe("WorkspaceService", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(
      new InMemoryWorkspaceRepository(),
      new InMemoryActiveWorkspaceStore(),
    );
  });

  it("creates a workspace", async () => {
    const workspace = await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    expect(workspace.slug).toBe("acme");
  });

  it("rejects a duplicate slug", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await expect(service.create({ slug: "acme", name: "Acme 2", currency: "USD" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("lists and looks up by slug", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    expect(await service.list()).toHaveLength(1);
    expect((await service.getBySlug("acme")).name).toBe("Acme");
  });

  it("throws NotFoundError for an unknown slug", async () => {
    await expect(service.getBySlug("nope")).rejects.toThrow(NotFoundError);
  });

  it("switches and resolves the active workspace", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await service.switchActive("acme");
    expect((await service.resolveActive()).slug).toBe("acme");
  });

  it("resolveActive prefers an explicit override over the active context", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await service.create({ slug: "other", name: "Other", currency: "USD" });
    await service.switchActive("acme");
    expect((await service.resolveActive("other")).slug).toBe("other");
  });

  it("resolveActive throws when nothing is active and no override is given", async () => {
    await expect(service.resolveActive()).rejects.toThrow(NotFoundError);
  });

  it("removes a workspace", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await service.remove("acme");
    expect(await service.list()).toHaveLength(0);
  });

  it("clears the active context when the active workspace is removed", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await service.create({ slug: "side", name: "Side", currency: "EUR" });
    await service.switchActive("acme");
    await service.remove("acme");
    await expect(service.resolveActive()).rejects.toThrow(NotFoundError);
    await expect(service.resolveActive()).rejects.toThrow(/none set/);
  });

  it("keeps the active context when a different workspace is removed", async () => {
    await service.create({ slug: "acme", name: "Acme", currency: "USD" });
    await service.create({ slug: "side", name: "Side", currency: "EUR" });
    await service.switchActive("acme");
    await service.remove("side");
    expect((await service.resolveActive()).slug).toBe("acme");
  });
});
