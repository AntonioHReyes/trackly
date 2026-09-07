# Repository guidelines for AI agents

This file applies to the whole repository. All code, comments, CLI copy,
commit messages, and docs must be in **English**.

## Architecture

Trackly is layered (Clean Architecture-ish), and dependencies only point
inward:

```
src/
├── domain/          entities, value objects, repository interfaces, errors
│                    — no framework or I/O code
├── application/      use cases (*Service) that orchestrate domain objects
│                    through repository/port interfaces
├── infrastructure/  concrete implementations: SQLite repositories, config
│                    stores, PDF/CSV exporters, the MCP server
└── cli/             Commander wiring only — parses argv, calls a service,
                     prints the result. No business logic here.
```

- `domain` never imports from `application`, `infrastructure`, or `cli`.
- `application` depends on `domain` interfaces (ports), never on concrete
  `infrastructure` classes — those are injected via `src/cli/container.ts`.
- New features get a domain/application piece first, an infrastructure
  implementation second, and a thin `cli/commands/*.ts` file last.

## Conventions

- SOLID, small single-purpose files. If a command file starts doing more
  than argv parsing + one service call, extract logic into the service.
- Constructor injection everywhere — no service reaches for a global or
  constructs its own dependencies. This is what makes the layers testable
  and swappable, and it's enforced by `@typescript-eslint/no-explicit-any`.
- Prefer explicit types over inference at public boundaries (service
  methods, repository interfaces).
- Errors that should produce a clean CLI message extend `DomainError`
  (`src/domain/errors/DomainError.ts`); anything else is a bug and should
  surface as a stack trace, not be silently swallowed.

## Workflow

```bash
pnpm install
pnpm dev -- <args>   # run the CLI from source, e.g. pnpm dev -- list
pnpm test            # vitest, tests live under tests/ mirroring src/
pnpm lint            # eslint, must pass before committing
pnpm format          # prettier --write
pnpm build            # tsc -> dist/
```

- Every new service/repository/exporter should have a corresponding test
  under `tests/`, mirroring the `src/` path.
- Run `pnpm lint` and `pnpm test` before considering a change done — CI
  runs both on every push and blocks npm publish otherwise.
- Commit messages: imperative mood, explain *why* when it's not obvious
  from the diff (`feat: ...`, `fix: ...`, `chore: ...` prefixes are used
  throughout the history).

## Releasing

Fully automated by `.github/workflows/release.yml`, which runs on every
push to `main` (except changes only under `.github/workflows/`), in one
job: reads the triggering commit's *header line* for a
Conventional-Commits-ish prefix (`feat:` → minor, `<type>!:` header or a
`BREAKING CHANGE:` footer → major, anything else → patch), bumps
`package.json` with `npm version`, commits it as `chore: release
vX.Y.Z`, tags it, pushes both, then publishes to npm with provenance and
creates the GitHub release — all in the same job, since a push made with
the default `GITHUB_TOKEN` does not trigger other workflows (GitHub's own
loop prevention), so the old two-workflow tag-handoff design doesn't work.
It skips itself on `chore: release` commits to avoid looping.

`.github/workflows/publish.yml` is now a manual-only fallback (a human
pushing a `vX.Y.Z` tag, or `workflow_dispatch`) to republish/recover a
specific version — it plays no part in the normal flow.

Never bump `version` or tag by hand — every push to `main` releases
something. Write commit messages with the prefix that matches the intended
bump, and keep words like "BREAKING CHANGE" out of prose in the body
unless you mean it as the real footer (line start) — the bump detection
matches on that.

## Do not

- Do not add native-dependency libraries for charts/PDF rendering (see the
  hand-built SVG chart code under `src/infrastructure/reporting/charts/`)
  — the whole point is `npm install -g` working with zero build tools.
- Do not put business logic in `src/cli/commands/*` — those files should
  stay thin.
