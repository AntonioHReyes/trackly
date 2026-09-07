import type { Command } from "commander";
import type { Container } from "../container.js";
import type { GitMetadata } from "../../domain/entities/TimeEntry.js";
import { readGitContext } from "../../infrastructure/git/GitContext.js";
import { GitHookInstaller } from "../../infrastructure/git/GitHookInstaller.js";
import { ValidationError } from "../../domain/errors/DomainError.js";
import * as ui from "../ui/index.js";

interface WorkspaceOpts {
  workspace?: string;
}

interface AttachOptions {
  repo?: string;
  commit?: string;
  branch?: string;
}

/**
 * `tck git-hook attach` — tags the running entry with commit metadata,
 * meant to be called from a repo's `post-commit` hook. Whether it also
 * stops the timer is controlled by `tck config set git-hook-stops-timer`.
 */
export function registerGitHookCommands(program: Command, container: Container): void {
  const workspaceOverride = (): string | undefined => (program.opts() as WorkspaceOpts).workspace;
  const gitHook = program.command("git-hook").description("Link commits to time entries");

  gitHook
    .command("attach")
    .description("Tag the running entry with the current (or given) commit")
    .option("--repo <name>", "repo name (defaults to the `origin` remote, or the folder name)")
    .option("--commit <sha>", "commit hash (defaults to HEAD)")
    .option("--branch <name>", "branch name (defaults to the current branch)")
    .action(async (options: AttachOptions) => {
      const workspace = await container.workspaceService.resolveActive(workspaceOverride());
      const git = resolveGitMetadata(options);
      const stopsTimer = container.configStore.read().gitHookStopsTimer;
      const entry = await container.timeEntryService.attachGit(workspace.id, git, {
        stop: stopsTimer,
      });
      const action = stopsTimer ? "Tagged and stopped" : "Tagged";
      ui.success(
        `${action} ${ui.em(entry.description)} with commit ${ui.cyan(git.commit.slice(0, 7))}`,
      );
      ui.hint(`${git.repo}@${git.branch} · tck config set git-hook-stops-timer true|false`);
    });

  gitHook
    .command("install")
    .description("Install a post-commit hook in the current repo that runs `tck git-hook attach`")
    .option("--force", "overwrite a pre-existing post-commit hook not managed by trackly")
    .action((options: { force?: boolean }) => {
      new GitHookInstaller().install(options);
      ui.success("Installed the post-commit hook");
      ui.hint("tck git-hook uninstall · tck config set git-hook-stops-timer true|false");
    });

  gitHook
    .command("uninstall")
    .description("Remove the post-commit hook installed by `tck git-hook install`")
    .action(() => {
      new GitHookInstaller().uninstall();
      ui.success("Removed the post-commit hook");
    });

  gitHook
    .command("status")
    .description("Show whether the post-commit hook is installed in the current repo")
    .action(() => {
      const status = new GitHookInstaller().status();
      const label = {
        "not-installed": ui.dim("not installed"),
        installed: ui.green("installed"),
        foreign: ui.yellow("a different hook is present"),
      }[status];
      ui.print(`post-commit hook: ${label}`);
    });
}

function resolveGitMetadata(options: AttachOptions): GitMetadata {
  const detected = readGitContext();
  const repo = options.repo ?? detected?.repo;
  const commit = options.commit ?? detected?.commit;
  const branch = options.branch ?? detected?.branch;
  if (!repo || !commit || !branch) {
    throw new ValidationError(
      "Could not determine git metadata — run inside a git repo or pass --repo/--commit/--branch",
    );
  }
  return { repo, commit, branch };
}
