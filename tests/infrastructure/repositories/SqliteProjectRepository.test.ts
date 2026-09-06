import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";
import { SqliteWorkspaceRepository } from "../../../src/infrastructure/repositories/SqliteWorkspaceRepository.js";
import { SqliteProjectRepository } from "../../../src/infrastructure/repositories/SqliteProjectRepository.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";

describe("SqliteProjectRepository", () => {
  let connection: SqliteConnection;
  let repo: SqliteProjectRepository;
  let workspaceId: string;

  beforeEach(async () => {
    connection = new SqliteConnection(":memory:");
    repo = new SqliteProjectRepository(connection.db);
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await new SqliteWorkspaceRepository(connection.db).save(workspace);
    workspaceId = workspace.id;
  });

  afterEach(() => {
    connection.close();
  });

  it("saves and finds a project by id", async () => {
    const project = Project.create({ workspaceId, name: "Website", hourlyRate: 60 });
    await repo.save(project);

    const found = await repo.findById(project.id);
    expect(found?.name).toBe("Website");
    expect(found?.hourlyRate).toBe(60);
  });

  it("lists projects by workspace, excluding archived by default", async () => {
    const active = Project.create({ workspaceId, name: "Active" });
    const archived = Project.create({ workspaceId, name: "Archived" }).archive();
    await repo.save(active);
    await repo.save(archived);

    const visible = await repo.findByWorkspace(workspaceId);
    expect(visible.map((p) => p.name)).toEqual(["Active"]);

    const all = await repo.findByWorkspace(workspaceId, { includeArchived: true });
    expect(all).toHaveLength(2);
  });

  it("upserts on save with the same id", async () => {
    const project = Project.create({ workspaceId, name: "Website" });
    await repo.save(project);
    await repo.save(project.withUpdates({ name: "Website v2" }));

    const found = await repo.findById(project.id);
    expect(found?.name).toBe("Website v2");
  });

  it("deletes a project", async () => {
    const project = Project.create({ workspaceId, name: "Website" });
    await repo.save(project);
    await repo.delete(project.id);
    expect(await repo.findById(project.id)).toBeNull();
  });

  it("cascades when its workspace is deleted", async () => {
    const project = Project.create({ workspaceId, name: "Website" });
    await repo.save(project);
    await new SqliteWorkspaceRepository(connection.db).delete(workspaceId);
    expect(await repo.findById(project.id)).toBeNull();
  });
});
