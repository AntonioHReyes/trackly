import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGitContext } from "../../../src/infrastructure/git/GitContext.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd });
}

describe("readGitContext", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function newRepo(): string {
    dir = mkdtempSync(join(tmpdir(), "trackly-git-context-"));
    git(dir, ["init", "--initial-branch=main"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    git(dir, ["config", "user.name", "Test"]);
    return dir;
  }

  it("reads commit and branch from a repo with no remote", () => {
    const repo = newRepo();
    writeFileSync(join(repo, "file.txt"), "content");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "Initial commit"]);

    const context = readGitContext(repo);
    expect(context).not.toBeNull();
    expect(context?.branch).toBe("main");
    expect(context?.commit).toMatch(/^[0-9a-f]{40}$/);
    // No `origin` remote — falls back to the checkout's directory name.
    expect(context?.repo).toBe(context && dir.split("/").pop());
  });

  it("reads the origin remote when one is configured", () => {
    const repo = newRepo();
    git(repo, ["remote", "add", "origin", "git@github.com:acme/trackly.git"]);
    writeFileSync(join(repo, "file.txt"), "content");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "Initial commit"]);

    const context = readGitContext(repo);
    expect(context?.repo).toBe("git@github.com:acme/trackly.git");
  });

  it("returns null outside a git repo", () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-git-context-"));
    expect(readGitContext(dir)).toBeNull();
  });
});
