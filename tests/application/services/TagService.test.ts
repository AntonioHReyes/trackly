import { describe, expect, it, beforeEach } from "vitest";
import { TagService } from "../../../src/application/services/TagService.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";
import { NotFoundError } from "../../../src/domain/errors/DomainError.js";

describe("TagService", () => {
  let service: TagService;
  const workspaceId = "ws-1";

  beforeEach(() => {
    service = new TagService(new InMemoryTagRepository());
  });

  it("creates and lists tags for a workspace", async () => {
    await service.create({ workspaceId, name: "billable" });
    expect(await service.list(workspaceId)).toHaveLength(1);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(service.getById("nope")).rejects.toThrow(NotFoundError);
  });

  it("removes a tag", async () => {
    const tag = await service.create({ workspaceId, name: "billable" });
    await service.remove(tag.id);
    await expect(service.getById(tag.id)).rejects.toThrow(NotFoundError);
  });
});
