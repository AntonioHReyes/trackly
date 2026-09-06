import { randomUUID } from "node:crypto";
import { Money } from "../value-objects/Money.js";
import { ValidationError } from "../errors/DomainError.js";
import type { Workspace } from "./Workspace.js";

export interface ProjectProps {
  id: string;
  workspaceId: string;
  name: string;
  client: string | null;
  color: string | null;
  hourlyRate: number | null;
  archived: boolean;
}

/**
 * A unit of billable/trackable work inside a workspace. Its own hourly rate,
 * when set, overrides the parent workspace's default (see
 * `resolveRate` and SPEC.md's rate-resolution rule).
 */
export class Project {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly client: string | null;
  readonly color: string | null;
  readonly hourlyRate: number | null;
  readonly archived: boolean;

  private constructor(props: ProjectProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.client = props.client;
    this.color = props.color;
    this.hourlyRate = props.hourlyRate;
    this.archived = props.archived;
  }

  static create(params: {
    workspaceId: string;
    name: string;
    client?: string | null;
    color?: string | null;
    hourlyRate?: number | null;
  }): Project {
    const name = Project.validateName(params.name);
    return new Project({
      id: randomUUID(),
      workspaceId: params.workspaceId,
      name,
      client: params.client ?? null,
      color: params.color ?? null,
      hourlyRate: params.hourlyRate ?? null,
      archived: false,
    });
  }

  static reconstruct(props: ProjectProps): Project {
    return new Project(props);
  }

  /** Returns an equivalent project with the given fields replaced. */
  withUpdates(updates: {
    name?: string;
    client?: string | null;
    color?: string | null;
    hourlyRate?: number | null;
  }): Project {
    return new Project({
      ...this,
      name: updates.name !== undefined ? Project.validateName(updates.name) : this.name,
      client: updates.client !== undefined ? updates.client : this.client,
      color: updates.color !== undefined ? updates.color : this.color,
      hourlyRate: updates.hourlyRate !== undefined ? updates.hourlyRate : this.hourlyRate,
    });
  }

  archive(): Project {
    return new Project({ ...this, archived: true });
  }

  /**
   * Resolves the effective hourly rate: this project's own rate if set,
   * otherwise the parent workspace's default. Returns `null` if neither is
   * set (the project/entries are then treated as non-billable by rate).
   */
  resolveRate(workspace: Workspace): Money | null {
    if (this.hourlyRate !== null) {
      return Money.fromDecimal(this.hourlyRate, workspace.currency);
    }
    return workspace.resolveDefaultRate();
  }

  private static validateName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Project name cannot be empty");
    }
    return trimmed;
  }
}
