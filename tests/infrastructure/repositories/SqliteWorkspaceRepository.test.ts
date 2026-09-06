import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";
import { SqliteWorkspaceRepository } from "../../../src/infrastructure/repositories/SqliteWorkspaceRepository.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { ConflictError } from "../../../src/domain/errors/DomainError.js";

describe("SqliteWorkspaceRepository", () => {
  let connection: SqliteConnection;
  let repo: SqliteWorkspaceRepository;

  beforeEach(() => {
    connection = new SqliteConnection(":memory:");
    repo = new SqliteWorkspaceRepository(connection.db);
  });

  afterEach(() => {
    connection.close();
  });

  it("saves and finds a workspace by id and by slug", async () => {
    const workspace = Workspace.create({ slug: "acme", name: "Acme Corp", currency: "USD" });
    await repo.save(workspace);

    const byId = await repo.findById(workspace.id);
    const bySlug = await repo.findBySlug("acme");

    expect(byId?.name).toBe("Acme Corp");
    expect(bySlug?.id).toBe(workspace.id);
  });

  it("returns null for a missing id or slug", async () => {
    expect(await repo.findById("nope")).toBeNull();
    expect(await repo.findBySlug("nope")).toBeNull();
  });

  it("upserts on save with the same id", async () => {
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await repo.save(workspace);
    const renamed = Workspace.reconstruct({ ...workspace, name: "Acme Renamed" });
    await repo.save(renamed);

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Acme Renamed");
  });

  it("rejects a duplicate slug with a domain ConflictError", async () => {
    await repo.save(Workspace.create({ slug: "acme", name: "Acme", currency: "USD" }));
    await expect(
      repo.save(Workspace.create({ slug: "acme", name: "Acme 2", currency: "USD" })),
    ).rejects.toThrow(ConflictError);
  });

  it("deletes a workspace", async () => {
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await repo.save(workspace);
    await repo.delete(workspace.id);
    expect(await repo.findById(workspace.id)).toBeNull();
  });
});
