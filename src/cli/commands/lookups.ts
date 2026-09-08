import type { Container } from "../container.js";
import { NotFoundError } from "../../domain/errors/DomainError.js";

/** Resolves a project by (case-insensitive) name, scoped to a workspace. */
export async function resolveProjectId(
  container: Container,
  workspaceId: string,
  name: string,
): Promise<string> {
  const projects = await container.projectService.list(workspaceId, true);
  const match = projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    throw new NotFoundError("Project", name);
  }
  return match.id;
}

/**
 * Resolves a (case-insensitive) client name into the ids of every project
 * tagged with it — a client can span several projects, unlike `--project`.
 */
export async function resolveProjectIdsByClient(
  container: Container,
  workspaceId: string,
  client: string,
): Promise<string[]> {
  const projects = await container.projectService.list(workspaceId, true);
  const matches = projects.filter((p) => p.client?.toLowerCase() === client.toLowerCase());
  if (matches.length === 0) {
    throw new NotFoundError("Client", client);
  }
  return matches.map((p) => p.id);
}

/** Resolves a comma-separated list of tag names into tag ids. */
export async function resolveTagIds(
  container: Container,
  workspaceId: string,
  namesCsv: string,
): Promise<string[]> {
  const names = namesCsv
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) return [];

  const tags = await container.tagService.list(workspaceId);
  return names.map((name) => {
    const match = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      throw new NotFoundError("Tag", name);
    }
    return match.id;
  });
}
