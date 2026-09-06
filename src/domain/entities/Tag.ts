import { randomUUID } from "node:crypto";
import { ValidationError } from "../errors/DomainError.js";

export interface TagProps {
  id: string;
  workspaceId: string;
  name: string;
}

/** A label applied to time entries for cross-project filtering/reporting. */
export class Tag {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;

  private constructor(props: TagProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
  }

  static create(params: { workspaceId: string; name: string }): Tag {
    return new Tag({
      id: randomUUID(),
      workspaceId: params.workspaceId,
      name: Tag.validateName(params.name),
    });
  }

  static reconstruct(props: TagProps): Tag {
    return new Tag(props);
  }

  private static validateName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Tag name cannot be empty");
    }
    return trimmed;
  }
}
