import { describe, expect, it, beforeEach } from "vitest";
import { TimeEntryService } from "../../../src/application/services/TimeEntryService.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryWorkspaceRepository } from "../../support/fakes/InMemoryWorkspaceRepository.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { NotFoundError, InvalidStateError } from "../../../src/domain/errors/DomainError.js";

describe("TimeEntryService", () => {
  let service: TimeEntryService;
  let projects: InMemoryProjectRepository;
  let workspaces: InMemoryWorkspaceRepository;
  const workspaceId = "ws-1";

  beforeEach(async () => {
    projects = new InMemoryProjectRepository();
    workspaces = new InMemoryWorkspaceRepository();
    service = new TimeEntryService(new InMemoryTimeEntryRepository(), projects, workspaces);
    await workspaces.save(
      Workspace.reconstruct({
        id: workspaceId,
        slug: "acme",
        name: "Acme",
        defaultHourlyRate: null,
        currency: "USD",
        createdAt: new Date(),
      }),
    );
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

  it("start() snapshots the resolved rate: project rate over workspace default", async () => {
    const project = Project.create({ workspaceId, name: "Website", hourlyRate: 50 });
    await projects.save(project);
    await workspaces.save(
      (await workspaces.findById(workspaceId))!.withDefaultHourlyRate(10),
    );

    const withProject = await service.start({
      workspaceId,
      description: "Coding",
      projectId: project.id,
    });
    expect(withProject.rate).toBe(50);

    const noProject = await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    expect(noProject.rate).toBe(10);
  });

  it("start()/addManual() let a manual rate override the resolved one", async () => {
    const project = Project.create({ workspaceId, name: "Website", hourlyRate: 50 });
    await projects.save(project);

    const started = await service.start({
      workspaceId,
      description: "Rush job",
      projectId: project.id,
      rate: 200,
    });
    expect(started.rate).toBe(200);

    const added = await service.addManual({
      workspaceId,
      description: "Pro bono",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId: project.id,
      rate: null,
    });
    expect(added.rate).toBeNull();
  });

  it("edit() lets an explicit rate override, even alongside a project change", async () => {
    const project = Project.create({ workspaceId, name: "Website", hourlyRate: 50 });
    await projects.save(project);
    const entry = await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId: project.id,
    });
    expect(entry.rate).toBe(50);

    const overridden = await service.edit(entry.id, { rate: 999 });
    expect(overridden.rate).toBe(999);

    const other = Project.create({ workspaceId, name: "Other", hourlyRate: 10 });
    await projects.save(other);
    const bothAtOnce = await service.edit(entry.id, { projectId: other.id, rate: 777 });
    expect(bothAtOnce.rate).toBe(777);
  });

  it("edit() re-snapshots the rate when the project changes, leaves it otherwise", async () => {
    const cheap = Project.create({ workspaceId, name: "Cheap", hourlyRate: 20 });
    const pricey = Project.create({ workspaceId, name: "Pricey", hourlyRate: 90 });
    await projects.save(cheap);
    await projects.save(pricey);

    const entry = await service.addManual({
      workspaceId,
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId: cheap.id,
    });
    expect(entry.rate).toBe(20);

    const renamed = await service.edit(entry.id, { description: "Refactoring" });
    expect(renamed.rate).toBe(20);

    const reassigned = await service.edit(entry.id, { projectId: pricey.id });
    expect(reassigned.rate).toBe(90);
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
