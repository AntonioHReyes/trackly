import { describe, expect, it, beforeEach } from "vitest";
import { ProjectService } from "../../../src/application/services/ProjectService.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { NotFoundError } from "../../../src/domain/errors/DomainError.js";

describe("ProjectService", () => {
  let service: ProjectService;
  const workspaceId = "ws-1";

  beforeEach(() => {
    service = new ProjectService(new InMemoryProjectRepository());
  });

  it("creates and retrieves a project", async () => {
    const project = await service.create({ workspaceId, name: "Website" });
    expect((await service.getById(project.id)).name).toBe("Website");
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(service.getById("nope")).rejects.toThrow(NotFoundError);
  });

  it("lists projects, excluding archived by default", async () => {
    const active = await service.create({ workspaceId, name: "Active" });
    const toArchive = await service.create({ workspaceId, name: "ToArchive" });
    await service.archive(toArchive.id);

    expect((await service.list(workspaceId)).map((p) => p.id)).toEqual([active.id]);
    expect(await service.list(workspaceId, true)).toHaveLength(2);
  });

  it("edits only the given fields", async () => {
    const project = await service.create({ workspaceId, name: "Website", client: "Bob" });
    const updated = await service.edit(project.id, { hourlyRate: 60 });
    expect(updated.client).toBe("Bob");
    expect(updated.hourlyRate).toBe(60);
  });

  it("removes a project", async () => {
    const project = await service.create({ workspaceId, name: "Website" });
    await service.remove(project.id);
    await expect(service.getById(project.id)).rejects.toThrow(NotFoundError);
  });
});
