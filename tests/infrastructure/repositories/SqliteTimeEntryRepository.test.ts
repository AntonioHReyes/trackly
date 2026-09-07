import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";
import { SqliteWorkspaceRepository } from "../../../src/infrastructure/repositories/SqliteWorkspaceRepository.js";
import { SqliteProjectRepository } from "../../../src/infrastructure/repositories/SqliteProjectRepository.js";
import { SqliteTagRepository } from "../../../src/infrastructure/repositories/SqliteTagRepository.js";
import { SqliteTimeEntryRepository } from "../../../src/infrastructure/repositories/SqliteTimeEntryRepository.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { Tag } from "../../../src/domain/entities/Tag.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { DateRange } from "../../../src/domain/value-objects/DateRange.js";

describe("SqliteTimeEntryRepository", () => {
  let connection: SqliteConnection;
  let repo: SqliteTimeEntryRepository;
  let workspaceId: string;
  let projectId: string;
  let tagId: string;

  beforeEach(async () => {
    connection = new SqliteConnection(":memory:");
    repo = new SqliteTimeEntryRepository(connection.db);

    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await new SqliteWorkspaceRepository(connection.db).save(workspace);
    workspaceId = workspace.id;

    const project = Project.create({ workspaceId, name: "Website" });
    await new SqliteProjectRepository(connection.db).save(project);
    projectId = project.id;

    const tag = Tag.create({ workspaceId, name: "billable" });
    await new SqliteTagRepository(connection.db).save(tag);
    tagId = tag.id;
  });

  afterEach(() => {
    connection.close();
  });

  it("saves and finds an entry with its tags", async () => {
    const entry = TimeEntry.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId,
      tagIds: [tagId],
    });
    await repo.save(entry);

    const found = await repo.findById(entry.id);
    expect(found?.description).toBe("Coding");
    expect(found?.tagIds).toEqual([tagId]);
  });

  it("round-trips the rate snapshot, including null", async () => {
    const withRate = TimeEntry.addManual({
      workspaceId,
      description: "Priced",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      rate: 42.5,
    });
    const withoutRate = TimeEntry.addManual({
      workspaceId,
      description: "Unpriced",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    await repo.save(withRate);
    await repo.save(withoutRate);

    expect((await repo.findById(withRate.id))?.rate).toBe(42.5);
    expect((await repo.findById(withoutRate.id))?.rate).toBeNull();
  });

  it("round-trips git metadata", async () => {
    const entry = TimeEntry.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    }).attachGit({ repo: "trackly", commit: "abc123", branch: "main" });
    await repo.save(entry);

    const found = await repo.findById(entry.id);
    expect(found?.source).toBe("git-hook");
    expect(found?.git).toEqual({ repo: "trackly", commit: "abc123", branch: "main" });
  });

  it("finds the running entry for a workspace", async () => {
    const running = TimeEntry.start({ workspaceId, description: "Coding" });
    await repo.save(running);
    expect((await repo.findRunning(workspaceId))?.id).toBe(running.id);
  });

  it("returns null when nothing is running", async () => {
    expect(await repo.findRunning(workspaceId)).toBeNull();
  });

  it("replaces tags on a subsequent save rather than accumulating them", async () => {
    const otherTag = Tag.create({ workspaceId, name: "internal" });
    await new SqliteTagRepository(connection.db).save(otherTag);

    const entry = TimeEntry.start({ workspaceId, description: "Coding", tagIds: [tagId] });
    await repo.save(entry);
    await repo.save(entry.withUpdates({ tagIds: [otherTag.id] }));

    const found = await repo.findById(entry.id);
    expect(found?.tagIds).toEqual([otherTag.id]);
  });

  it("filters by workspace and date range", async () => {
    const inRange = TimeEntry.addManual({
      workspaceId,
      description: "In range",
      startTs: new Date("2026-01-05T09:00:00Z"),
      endTs: new Date("2026-01-05T10:00:00Z"),
    });
    const outOfRange = TimeEntry.addManual({
      workspaceId,
      description: "Out of range",
      startTs: new Date("2026-02-01T09:00:00Z"),
      endTs: new Date("2026-02-01T10:00:00Z"),
    });
    await repo.save(inRange);
    await repo.save(outOfRange);

    const results = await repo.findByFilter({
      workspaceId,
      range: DateRange.of(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z")),
    });
    expect(results.map((e) => e.description)).toEqual(["In range"]);
  });

  it("filters by project, tag, and billable flag", async () => {
    const matching = TimeEntry.addManual({
      workspaceId,
      description: "Matching",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId,
      tagIds: [tagId],
      billable: true,
    });
    const nonBillable = TimeEntry.addManual({
      workspaceId,
      description: "Non-billable",
      startTs: new Date("2026-01-01T11:00:00Z"),
      endTs: new Date("2026-01-01T12:00:00Z"),
      projectId,
      billable: false,
    });
    await repo.save(matching);
    await repo.save(nonBillable);

    const byProject = await repo.findByFilter({ workspaceId, projectId });
    expect(byProject).toHaveLength(2);

    const byTag = await repo.findByFilter({ workspaceId, tagId });
    expect(byTag.map((e) => e.description)).toEqual(["Matching"]);

    const billableOnly = await repo.findByFilter({ workspaceId, billable: true });
    expect(billableOnly.map((e) => e.description)).toEqual(["Matching"]);
  });

  it("deletes an entry and its tag associations", async () => {
    const entry = TimeEntry.start({ workspaceId, description: "Coding", tagIds: [tagId] });
    await repo.save(entry);
    await repo.delete(entry.id);
    expect(await repo.findById(entry.id)).toBeNull();

    const orphanedTagRows = connection.db
      .prepare("SELECT * FROM time_entry_tags WHERE time_entry_id = ?")
      .all(entry.id);
    expect(orphanedTagRows).toHaveLength(0);
  });
});
