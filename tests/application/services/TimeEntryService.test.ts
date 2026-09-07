import { describe, expect, it, beforeEach } from "vitest";
import { TimeEntryService } from "../../../src/application/services/TimeEntryService.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { NotFoundError, InvalidStateError } from "../../../src/domain/errors/DomainError.js";

describe("TimeEntryService", () => {
  let service: TimeEntryService;
  let projects: InMemoryProjectRepository;
  const workspaceId = "ws-1";

  beforeEach(() => {
    projects = new InMemoryProjectRepository();
    service = new TimeEntryService(new InMemoryTimeEntryRepository(), projects);
  });

  it("start() creates a running entry", async () => {
    const entry = await service.start({ workspaceId, description: "Coding" });
    expect(entry.isRunning()).toBe(true);
  });

  it("start() rejects a project from another workspace", async () => {
    const project = Project.create({ workspaceId: "ws-other", name: "Website" });
    await projects.save(project);
    await expect(
      service.start({ workspaceId, description: "Coding", projectId: project.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("start() auto-stops the previously running entry", async () => {
    const first = await service.start({ workspaceId, description: "First" });
    const second = await service.start({ workspaceId, description: "Second" });

    const reloadedFirst = await service.getById(first.id);
    expect(reloadedFirst.isRunning()).toBe(false);
    expect(second.isRunning()).toBe(true);
  });

  it("stop() finishes the running entry", async () => {
    await service.start({ workspaceId, description: "Coding" });
    const stopped = await service.stop(workspaceId);
    expect(stopped.isRunning()).toBe(false);
  });

  it("stop() throws when nothing is running", async () => {
    await expect(service.stop(workspaceId)).rejects.toThrow(InvalidStateError);
  });

  it("addManual() creates a finished entry", async () => {
    const entry = await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    expect(entry.durationHours()).toBe(1);
  });

  it("edit() applies partial updates", async () => {
    const entry = await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    const updated = await service.edit(entry.id, { description: "Refactoring" });
    expect(updated.description).toBe("Refactoring");
  });

  it("remove() deletes an entry", async () => {
    const entry = await service.start({ workspaceId, description: "Coding" });
    await service.remove(entry.id);
    await expect(service.getById(entry.id)).rejects.toThrow(NotFoundError);
  });

  it("status() returns the running entry or null", async () => {
    expect(await service.status(workspaceId)).toBeNull();
    const entry = await service.start({ workspaceId, description: "Coding" });
    expect((await service.status(workspaceId))?.id).toBe(entry.id);
  });

  it("attachGit() tags the running entry without stopping it by default", async () => {
    const entry = await service.start({ workspaceId, description: "Coding" });
    const git = { repo: "trackly", commit: "abc123", branch: "main" };
    const tagged = await service.attachGit(workspaceId, git);
    expect(tagged.id).toBe(entry.id);
    expect(tagged.git).toEqual(git);
    expect(tagged.isRunning()).toBe(true);
  });

  it("attachGit() stops the entry when stop: true", async () => {
    await service.start({ workspaceId, description: "Coding" });
    const tagged = await service.attachGit(
      workspaceId,
      { repo: "trackly", commit: "abc123", branch: "main" },
      { stop: true },
    );
    expect(tagged.isRunning()).toBe(false);
  });

  it("attachGit() throws when nothing is running", async () => {
    await expect(
      service.attachGit(workspaceId, { repo: "trackly", commit: "abc123", branch: "main" }),
    ).rejects.toThrow(InvalidStateError);
  });

  it("list() delegates to the repository filter", async () => {
    await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    expect(await service.list({ workspaceId })).toHaveLength(1);
  });
});
