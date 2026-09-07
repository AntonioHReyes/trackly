import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ConflictError, NotFoundError } from "../../domain/errors/DomainError.js";

/** Marks a `post-commit` file as one `tck git-hook install` wrote, so uninstall knows it's safe to remove. */
const MARKER = "# installed by trackly (tck git-hook install)";

const HOOK_SCRIPT = `#!/bin/sh
${MARKER}
# Tags the entry running when this commit was made; never blocks the commit.
tck git-hook attach || true
`;

export type GitHookStatus = "not-installed" | "installed" | "foreign";

/**
 * Writes/removes the `post-commit` hook that calls \`tck git-hook attach\`
 * after every commit (see \`tck git-hook install/uninstall\`). Resolves the
 * hook path through git itself (\`--git-path\`) so it works from worktrees
 * and repos with a relocated \`.git\` dir, not just a plain \`.git/hooks\`.
 */
export class GitHookInstaller {
  constructor(private readonly cwd: string = process.cwd()) {}

  /** Throws if `cwd` isn't inside a git repo — every other method assumes this passed. */
  private hookPath(): string {
    let relative: string;
    try {
      relative = execFileSync("git", ["rev-parse", "--git-path", "hooks/post-commit"], {
        cwd: this.cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      throw new NotFoundError("Git repository", this.cwd);
    }
    return isAbsolute(relative) ? relative : join(this.cwd, relative);
  }

  status(): GitHookStatus {
    const path = this.hookPath();
    if (!existsSync(path)) return "not-installed";
    return readFileSync(path, "utf8").includes(MARKER) ? "installed" : "foreign";
  }

  /** Writes the hook, refusing to clobber a pre-existing one unless `force` is set. */
  install(options: { force?: boolean } = {}): void {
    const path = this.hookPath();
    if (this.status() === "foreign" && !options.force) {
      throw new ConflictError(
        `${path} already exists and wasn't installed by trackly — pass --force to overwrite it`,
      );
    }
    writeFileSync(path, HOOK_SCRIPT, "utf8");
    chmodSync(path, 0o755);
  }

  /** Removes the hook, but only if trackly installed it — a foreign hook is left alone. */
  uninstall(): void {
    const status = this.status();
    if (status === "not-installed") return;
    if (status === "foreign") {
      throw new ConflictError(
        `${this.hookPath()} wasn't installed by trackly — remove it manually if that's intended`,
      );
    }
    rmSync(this.hookPath());
  }
}
