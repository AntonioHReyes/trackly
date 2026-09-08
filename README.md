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
  you only override where it differs. Each entry freezes the rate it
  resolved to when created, so a later rate change never repriced work
  already tracked.
- **Clients** — tag a project with `--client` and slice everything by it:
  one client can own several projects, and `--client` filters reports,
  exports, invoices, and earnings across all of them at once.
- **Earnings** — `tck earnings` answers "how much did I make?" for today,
  this week, this month and this year at a glance, with monthly trend bars
  and a comparison against the previous period.
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
- **Git-hook linking** — `tck git-hook attach` tags the running entry with
  the current commit (repo/branch/sha), for wiring into a `post-commit`
  hook.

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
tck project list --client "Acme Corp"   # only this client's projects
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

`start`/`add`/`edit` all take a `--rate <amount>` to bill that one entry at a
specific rate instead of what the project/workspace resolves to — see
[Rates](#rates).

### Rates

```bash
tck rate set 50                    # workspace default
tck rate set 90 --project Website  # project override
```

Every time entry snapshots the rate it resolved to (project rate, falling
back to the workspace default) the moment it's created. Reports and invoices
always bill an entry at *its own* frozen rate, so raising `tck rate set`
tomorrow only affects entries tracked from then on — it never retroactively
reprices what you already logged.

Need to bill a single entry differently from what it would otherwise
resolve to (a one-off rush rate, a discount, a fixed price)? Override it
directly, at creation or after the fact:

```bash
tck add "Rush job" --project Website --from ... --to ... --rate 300
tck start "Weekend on-call" --rate 150
tck edit <id> --rate 999          # repriced after the fact
```

There's no CLI flag to clear a manual override back to auto-resolved yet —
reassigning the entry to its current project (`tck edit <id> --project
Website`) re-snapshots it from the project/workspace rate instead.

`tck list`, `tck show`, and `tck status` all display the rate an entry is
billed at (or `—` when none resolves, e.g. no rate configured anywhere).

### Git-hook linking

Tags the running entry with the current commit's repo, branch, and hash —
handy for tracing _what got done_ in an entry back to _what shipped_.

```bash
tck git-hook attach                                  # reads repo/branch/commit from cwd
tck git-hook attach --repo trackly --commit abc123 --branch main
```

Install a `post-commit` hook in the current repo so every commit calls it
automatically:

```bash
tck git-hook install            # writes .git/hooks/post-commit
tck git-hook install --force    # overwrite a pre-existing post-commit hook
tck git-hook status             # not-installed | installed | a different hook is present
tck git-hook uninstall          # removes the hook, only if trackly installed it
```

`install`/`uninstall` are per-repo (run them from inside the repo you want
hooked) and never touch a hook trackly didn't write — `install` refuses to
clobber a foreign one without `--force`, and `uninstall` refuses to delete
one. By default the hook only tags the running entry; opt into also
stopping it:

```bash
tck config set git-hook-stops-timer true   # a commit now also stops the timer
tck config set git-hook-stops-timer false  # back to tagging only (default)
```

### Date shortcuts

Shared by `list`, `report pdf`, `report chart`, `export csv`, `invoice pdf`,
and `earnings`:

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

All three accept `--project`, `--client`, `--tag`,
`--billable`/`--non-billable`, and rounding flags (`--rounding`,
`--rounding-minutes`), on top of the date shortcuts above. `report chart`
renders the same hours-by-day and hours-by-project data as `report pdf`, as
ANSI bar charts instead of a file — handy for a quick look without opening
anything. `--section days | projects | both` picks which one to show
(default `both`).

`export csv` writes both `duration_hours` (decimal, e.g. `1.5000`, for
spreadsheet math) and `duration_hhmm` (`01:30`, for reading at a glance) per
row, plus a `commit` column populated by [git-hook linking](#git-hook-linking)
when an entry has one.

### Filtering by client

A workspace can hold several clients, each with several projects. Tag a
project once with `--client`, and `--client <name>` then filters by all of
that client's projects at once — no need to remember which ones they own:

```bash
tck project create "Acme Site" --client "Acme Inc" --rate 100
tck project create "Acme App"  --client "Acme Inc" --rate 80

tck report chart --client "Acme Inc" --this-month
tck export csv   --client "Acme Inc" --last-month -o acme.csv
tck invoice pdf  --client "Acme Inc" --last-month -o acme-invoice.pdf
tck earnings     --client "Acme Inc" --this-month
```

Client names match case-insensitively. An unknown client is an error rather
than an empty result, so a typo can't quietly read as "you earned nothing".

### Earnings

How much the tracked time is actually worth. With no date flag, `tck
earnings` summarizes the periods you usually care about, plus a six-month
trend:

```bash
tck earnings
```

```
Earnings acme

 Period           Earned   Hours  Billable
 ──────────  ───────────  ──────  ────────
 Today        700.00 USD   7.50h  100%
 This week    700.00 USD   7.50h  100%
 This month  1000.00 USD  12.50h  100%
 This year   2500.00 USD  28.50h  100%

Monthly trend (last 6 months)
  May 2026  ██████████░░░░░░░░░░░░░░░░░░░░░░   300.00 USD 3.00h
  Jun 2026  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  —
  Jul 2026  █████████████░░░░░░░░░░░░░░░░░░░   400.00 USD 5.00h
  Aug 2026  ██████████████████████████░░░░░░   800.00 USD 8.00h
  Sep 2026  ████████████████████████████████  1000.00 USD 12.50h
```

Add any [date shortcut](#date-shortcuts) to drill into one period instead.
That view compares against the period before it, charts income over time,
and breaks the total down by project:

```bash
tck earnings --this-week
tck earnings --last-month --client "Acme Inc"
tck earnings --from 2026-01-01 --to 2026-04-01
```

```
Earnings · This week acme
  700.00 USD   7.50h billable of 7.50h tracked
  ▲ +133% vs previous period (300.00 USD)
```

Calendar shortcuts compare against their natural counterpart (`--this-month`
vs last month); rolling and custom ranges against the window of equal length
right before them. Ranges longer than about two months chart one bar per
month instead of per day. `--project`, `--client` and the rounding flags all
apply, and billable hours with no resolvable rate are called out rather than
silently counted as zero.

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
tck config set git-hook-stops-timer true
tck config get
tck backup
tck restore ~/.config/trackly/backups/trackly-<timestamp>.sql
```

## Example workflows

### A day of client work, start to invoice

```bash
tck workspace switch acme
tck start "Fix checkout bug" --project Website --tags urgent
# ...work...
tck stop
tck start "Client call" --project Website --no-billable
# ...call...
tck stop

tck list --today                      # sanity-check what got logged
tck report pdf --this-month -o report.pdf
tck invoice pdf --last-month --number INV-2026-014 \
  --bill-to "Acme Corp\nAttn: Finance" --due-date 2026-09-15 -o invoice.pdf
```

Non-billable entries (like the call above) show up in reports but are
excluded from invoices automatically.

### A coding task, with commits linked automatically

One-time setup per repo:

```bash
cd ~/code/website
tck workspace switch acme
tck git-hook install
```

Then, day to day:

```bash
tck start "Add POST /users endpoint" --project Website
# ...code, then commit as usual...
git add .
git commit -m "Add POST /users endpoint"
# → the hook runs automatically: "Tagged Add POST /users endpoint with commit a1b2c3d"
git commit -m "Add tests"
# → re-tags the same entry with the newer commit (only the last one sticks)
tck stop
```

`git-hook-stops-timer` (default `false`) decides whether that last commit
also stops the timer for you, instead of running `tck stop` by hand:

```bash
tck config set git-hook-stops-timer true
```

The hook is per-repo — install it in every repo whose commits you want
linked to entries; the timer and workspace stay the same across all of them.

### Juggling multiple clients in one day

```bash
tck -w acme start "Standup"
tck -w acme stop
tck -w other-client start "Bug triage"
tck -w other-client stop
```

`-w/--workspace` overrides the active workspace for a single command, so
you don't have to `switch` back and forth when bouncing between clients.

Clients that share a workspace don't need separate workspaces at all — tag
their projects with `--client` and slice by it when it's time to report or
bill:

```bash
tck earnings --client "Acme Inc" --this-month
tck invoice pdf --client "Acme Inc" --last-month -o acme.pdf
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
projects, tags, time entries, reports, and earnings as tools — so an AI
client can manage your time tracking directly instead of shelling out to
`tck`. Every tool wraps the same application service the CLI uses, so the
two can't disagree on business rules.

Earnings and reporting tools take the same filters as their CLI
counterparts, including `client`:

| Tool | Mirrors |
|---|---|
| `get_earnings_summary` | `tck earnings` (today / week / month / year + monthly trend) |
| `get_earnings_for_range` | `tck earnings --this-month` (one period, vs. the previous one) |
| `get_report_summary` | `tck report chart` |
| `export_report_pdf` / `export_report_csv` | `tck report pdf` / `tck export csv` |

So you can just ask: *"how much did I bill Acme Inc this month, and how does
it compare to last month?"*

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
