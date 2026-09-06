import type { Tag } from "../entities/Tag.js";

export interface TagRepository {
  save(tag: Tag): Promise<void>;
  findById(id: string): Promise<Tag | null>;
  findByWorkspace(workspaceId: string): Promise<Tag[]>;
  delete(id: string): Promise<void>;
}
