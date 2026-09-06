import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";
import { SqliteWorkspaceRepository } from "../../../src/infrastructure/repositories/SqliteWorkspaceRepository.js";
import { SqliteTagRepository } from "../../../src/infrastructure/repositories/SqliteTagRepository.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Tag } from "../../../src/domain/entities/Tag.js";

describe("SqliteTagRepository", () => {
  let connection: SqliteConnection;
  let repo: SqliteTagRepository;
  let workspaceId: string;

  beforeEach(async () => {
    connection = new SqliteConnection(":memory:");
    repo = new SqliteTagRepository(connection.db);
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await new SqliteWorkspaceRepository(connection.db).save(workspace);
    workspaceId = workspace.id;
  });

  afterEach(() => {
    connection.close();
  });

  it("saves and finds a tag by id", async () => {
    const tag = Tag.create({ workspaceId, name: "billable" });
    await repo.save(tag);
    expect((await repo.findById(tag.id))?.name).toBe("billable");
  });

  it("lists tags by workspace, alphabetically", async () => {
    await repo.save(Tag.create({ workspaceId, name: "zeta" }));
    await repo.save(Tag.create({ workspaceId, name: "alpha" }));
    const tags = await repo.findByWorkspace(workspaceId);
    expect(tags.map((t) => t.name)).toEqual(["alpha", "zeta"]);
  });

  it("deletes a tag", async () => {
    const tag = Tag.create({ workspaceId, name: "billable" });
    await repo.save(tag);
    await repo.delete(tag.id);
    expect(await repo.findById(tag.id)).toBeNull();
  });
});
