import type { Tag } from "../../../src/domain/entities/Tag.js";
import type { TagRepository } from "../../../src/domain/repositories/TagRepository.js";

export class InMemoryTagRepository implements TagRepository {
  private readonly byId = new Map<string, Tag>();

  async save(tag: Tag): Promise<void> {
    this.byId.set(tag.id, tag);
  }

  async findById(id: string): Promise<Tag | null> {
    return this.byId.get(id) ?? null;
  }

  async findByWorkspace(workspaceId: string): Promise<Tag[]> {
    return [...this.byId.values()].filter((t) => t.workspaceId === workspaceId);
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}
