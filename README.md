# trackly

[![npm](https://img.shields.io/npm/v/%40tonyakitori%2Ftrackly)](https://www.npmjs.com/package/@tonyakitori/trackly)
[![license](https://img.shields.io/npm/l/%40tonyakitori%2Ftrackly?cacheSeconds=1)](./LICENSE)

A Toggl-style time-tracking CLI, `tck`, for people who'd rather stay in a
terminal than open a browser tab. Track time per client via workspaces, bill
it with PDF invoices, and let an AI assistant drive the whole thing through
its built-in MCP server.

## Why

Most time trackers are SaaS dashboards. `tck` is a single local SQLite
database plus a CLI: no account, no network dependency, no subscription.
It's built for freelancers/contractors juggling several clients who want
`start`/`stop` timers, honest reports, and invoices that come straight out
of the same data — without leaving the shell.

## Features

- **Workspaces** — one per client/context, isolating projects, tags, and
  entries so hours never mix across clients.
- **Timers & manual entries** — `start`/`stop` a running timer, or `add` a
  completed entry with an explicit range.
- **Projects, tags, rates** — hourly rates resolve project → workspace, so
  you only override where it differs.
- **Reports & exports** — PDF reports with charts (bar/donut, hand-built
  SVG, zero native deps), flat CSV exports, and ANSI bar charts straight in
  the terminal (`report chart`), all sharing the same date and filter
  shortcuts.
- **Invoices** — PDF invoices priced from billable time, with tax, saved
  defaults, and an auto-incrementing number template.
- **Report presets** — save a recurring filter combination once, reuse it
  across `report pdf`, `export csv`, and `invoice pdf`.
- **Rounding** — round entry durations for reporting purposes only (raw
  timestamps are never rewritten) on any minute increment.
- **MCP server** — `tck mcp` exposes the same functionality as MCP tools,
  so Claude Desktop/Claude Code can manage your time tracking directly.
- **Backup/restore** — a binary `.db` copy plus a diffable SQL dump on
  every backup.

Git-hook integration (`tck git install-hook`, auto-suggesting a time entry
from your commits) is planned but not yet implemented.

## Install

```bash
npm install -g @tonyakitori/trackly
```

This puts `tck` on your `PATH`. Verify with `tck --version`.

## Quick start

```bash
tck workspace create acme "Acme Corp" --currency USD --rate 50
tck workspace switch acme
tck project create Website --client "Acme Corp" --rate 75

tck start "Fixing the checkout bug" --project Website --tags urgent
tck stop
tck status
tck list --this-week --project Website

tck report pdf --this-month -o report.pdf
```

Every command accepts a global `-w/--workspace <slug>` to override the
active workspace for that one invocation.

## Usage

### Workspaces, projects, tags

```bash
tck workspace create acme "Acme Corp" --currency USD --rate 50
tck workspace switch acme
tck workspace list
tck workspace set-currency acme EUR
tck workspace rm acme

tck project create Website --client "Acme Corp" --rate 75
tck project list
tck project edit <id> --name "Website Revamp"
tck project archive <id>
tck project rm <id>

tck tag create urgent
tck tag list
tck tag rm <id>
```

### Time entries

```bash
tck start "Fixing the checkout bug" --project Website --tags urgent
tck stop
tck add "Client call" --from 2026-01-05T09:00 --to 2026-01-05T10:00 --project Website
tck status
tck list --this-week --project Website
tck show <id>                                   # full, untruncated entry detail
tck edit <id> --description "Fixing the checkout bug (follow-up)"
tck rm <id>
```

### Rates

```bash
tck rate set 50                    # workspace default
tck rate set 90 --project Website  # project override
```

### Date shortcuts

Shared by `list`, `report pdf`, `export csv`, and `invoice pdf`:

```
--today --yesterday --this-week --last-week --this-month --last-month
--last-7-days --last-30-days --this-year --last-year
--from <datetime> --to <datetime>
```

Calendar shortcuts snap to natural boundaries (a month is the 1st to the
last day); `--last-N-days` are rolling windows that include today.
`--this-week`/`--last-week` honor `tck config set week-start`.

### Reports and exports

```bash
tck report pdf --this-month -o report.pdf
tck report pdf --last-month --project Website -o september.pdf
tck export csv --from 2026-01-01 --to 2026-02-01 -o export.csv
tck report chart --this-week                      # bar charts, right in the terminal
tck report chart --this-month --section projects  # just the by-project breakdown
```

All three accept `--project`, `--tag`, `--billable`/`--non-billable`, and
rounding flags (`--rounding`, `--rounding-minutes`), on top of the date
shortcuts above. `report chart` renders the same hours-by-day and
hours-by-project data as `report pdf`, as ANSI bar charts instead of a
file — handy for a quick look without opening anything. `--section days
| projects | both` picks which one to show (default `both`).

### Invoices

Prices billable hours by project (rate resolved the same way as reports),
applies tax, and totals. Non-billable entries are always excluded.

```bash
tck invoice pdf --number INV-2026-014 --last-month \
  --bill-to "Acme Corp\nAttn: Finance\n123 Main St" \
  --due-date 2026-09-15 --tax-rate 21 -o invoice.pdf
```

Save recurring defaults so you don't retype them:

```bash
tck invoice config set --bill-to "Acme Corp\nAttn: Finance\n123 Main St" \
  --tax-rate 21 --number-template "INV-2026-%03d"
tck invoice pdf --last-month -o invoice.pdf   # uses saved defaults + next number
tck invoice config get
```

### Report presets

Save a recurring filter combo once, reuse it everywhere:

```bash
tck report preset save monthly-rounded --last-month --rounding up --rounding-minutes 15
tck report pdf --preset monthly-rounded -o report.pdf
tck export csv --preset monthly-rounded -o export.csv   # override just one flag: --rounding down
tck report preset list
tck report preset rm monthly-rounded
```

### Rounding

Applied to reported/exported/invoiced time only — stored timestamps are
never rewritten, so changing the setting just changes how existing data
renders. Modes: `none`, `nearest` (half-up), `up`, `down`, on any
whole-minute increment.

```bash
tck report pdf --this-month --rounding up --rounding-minutes 15
tck report pdf --this-month --hide-rounding   # keep the note out of the document
tck config set rounding nearest        # default for every report/export
tck config set rounding-minutes 6
```

### Config and backup

```bash
tck config set week-start sunday
tck config get
tck backup
tck restore ~/.config/trackly/backups/trackly-<timestamp>.sql
```

## Storage

The database lives at `~/.config/trackly/trackly.db` by default, overridable
with `tck config set db-path <path>` (e.g. to point it at a cloud-synced
folder). SQLite plus cloud sync doesn't tolerate concurrent writes from two
machines well before a sync finishes, so: use journal mode `DELETE` (the
default here, kept to minimize auxiliary files that could confuse a sync
client), only run `tck` from one active machine at a time, and lean on
`tck backup` — it writes a timestamped, diffable SQL dump alongside the
binary `.db` copy, so a bad sync is recoverable.

## MCP server (Claude Desktop / Claude Code)

`tck mcp` runs Trackly as an MCP server over stdio, exposing workspaces,
projects, tags, time entries, and reports as tools — so an AI client can
manage your time tracking directly instead of shelling out to `tck`.

Add it to Claude Desktop's config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "trackly": {
      "command": "tck",
      "args": ["mcp"]
    }
  }
}
```

Restart Claude Desktop after editing. For Claude Code, add the same server
with `claude mcp add trackly -- tck mcp`.

## Architecture

`tck` follows a layered design (domain → application → infrastructure,
with `cli/` as thin Commander wiring only) so storage, reporting, and MCP
concerns stay swappable and independently testable. See
[`AGENTS.md`](./AGENTS.md) for the full layout and conventions — it's the
reference used when extending the codebase, human or AI.

## Develop

```bash
pnpm install
pnpm dev -- --help
pnpm test
pnpm lint
pnpm build
```

## License

MIT — see [`LICENSE`](./LICENSE).

---

## Buy me a coffee

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/anhr9728w)

---
