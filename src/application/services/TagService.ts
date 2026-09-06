import { Tag } from "../../domain/entities/Tag.js";
import type { TagRepository } from "../../domain/repositories/TagRepository.js";
import { NotFoundError } from "../../domain/errors/DomainError.js";

export class TagService {
  constructor(private readonly tags: TagRepository) {}

  async create(params: { workspaceId: string; name: string }): Promise<Tag> {
    const tag = Tag.create(params);
    await this.tags.save(tag);
    return tag;
  }

  async list(workspaceId: string): Promise<Tag[]> {
    return this.tags.findByWorkspace(workspaceId);
  }

  async getById(id: string): Promise<Tag> {
    const tag = await this.tags.findById(id);
    if (!tag) {
      throw new NotFoundError("Tag", id);
    }
    return tag;
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.tags.delete(id);
  }
}
