import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHookInstaller } from "../../../src/infrastructure/git/GitHookInstaller.js";
import { ConflictError, NotFoundError } from "../../../src/domain/errors/DomainError.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd });
}

describe("GitHookInstaller", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function newRepo(): string {
    dir = mkdtempSync(join(tmpdir(), "trackly-git-hook-"));
    git(dir, ["init", "--initial-branch=main"]);
    return dir;
  }

  function hookPath(repo: string): string {
    return join(repo, ".git", "hooks", "post-commit");
  }

  it("throws when the cwd isn't a git repo", () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-git-hook-"));
    expect(() => new GitHookInstaller(dir).status()).toThrow(NotFoundError);
  });

  it("reports not-installed, then installed after install()", () => {
    const repo = newRepo();
    const installer = new GitHookInstaller(repo);
    expect(installer.status()).toBe("not-installed");

    installer.install();
    expect(installer.status()).toBe("installed");
    const content = readFileSync(hookPath(repo), "utf8");
    expect(content).toContain("tck git-hook attach");
  });

  it("refuses to overwrite a foreign hook without --force", () => {
    const repo = newRepo();
    writeFileSync(hookPath(repo), "#!/bin/sh\necho custom\n");
    const installer = new GitHookInstaller(repo);
    expect(installer.status()).toBe("foreign");
    expect(() => installer.install()).toThrow(ConflictError);
  });

  it("overwrites a foreign hook when force: true", () => {
    const repo = newRepo();
    writeFileSync(hookPath(repo), "#!/bin/sh\necho custom\n");
    const installer = new GitHookInstaller(repo);
    installer.install({ force: true });
    expect(installer.status()).toBe("installed");
  });

  it("uninstall() removes a hook it installed", () => {
    const repo = newRepo();
    const installer = new GitHookInstaller(repo);
    installer.install();
    installer.uninstall();
    expect(installer.status()).toBe("not-installed");
  });

  it("uninstall() is a no-op when nothing is installed", () => {
    const repo = newRepo();
    expect(() => new GitHookInstaller(repo).uninstall()).not.toThrow();
  });

  it("uninstall() refuses to remove a foreign hook", () => {
    const repo = newRepo();
    writeFileSync(hookPath(repo), "#!/bin/sh\necho custom\n");
    chmodSync(hookPath(repo), 0o755);
    expect(() => new GitHookInstaller(repo).uninstall()).toThrow(ConflictError);
  });
});
