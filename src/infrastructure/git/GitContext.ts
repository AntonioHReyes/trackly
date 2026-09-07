import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import type { GitMetadata } from "../../domain/entities/TimeEntry.js";

/**
 * Reads commit/branch/remote metadata from the git repo at `cwd`, for `tck
 * git-hook attach` to fall back to when the caller doesn't pass explicit
 * `--repo`/`--commit`/`--branch` flags. Returns `null` outside a git repo.
 */
export function readGitContext(cwd: string = process.cwd()): GitMetadata | null {
  const commit = run(cwd, ["rev-parse", "HEAD"]);
  if (!commit) return null;

  // Detached HEAD prints an empty string here rather than failing.
  const branch = run(cwd, ["branch", "--show-current"]) ?? "";
  const repo = run(cwd, ["remote", "get-url", "origin"]) ?? fallbackRepoName(cwd);
  return { repo, commit, branch };
}

/** No `origin` remote configured — use the repo's top-level directory name instead. */
function fallbackRepoName(cwd: string): string {
  const toplevel = run(cwd, ["rev-parse", "--show-toplevel"]);
  return toplevel ? basename(toplevel) : "unknown";
}

function run(cwd: string, args: string[]): string | null {
  try {
    // stdio: pipe stderr — git's "not a repo"/"no such remote" noise isn't
    // an error here, it's how we detect there's nothing to report.
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
