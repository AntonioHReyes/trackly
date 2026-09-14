/**
 * Hand-written FAQ for the docs page. Unlike the command reference (read
 * straight from Commander), these answer the "why/whether" questions no
 * flag description can, and are what search engines surface as rich
 * results — so they're prose, kept deliberately close to how someone would
 * phrase the question.
 *
 * Answers support a tiny markup subset: `code`, [text](url), and blank
 * lines splitting paragraphs. Everything else is escaped.
 */
export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: "What is trackly?",
    answer:
      "trackly is a time-tracking CLI installed as `tck`. It gives you `start`/`stop` timers, projects and clients, hourly rates, PDF/CSV reports and PDF invoices — all from the terminal, backed by one local SQLite file.",
  },
  {
    question: "Is trackly a Toggl alternative for the terminal?",
    answer:
      "That's the idea. It borrows Toggl's model — workspaces, projects, tags, billable hours — but drops the SaaS part: no account, no browser tab, no subscription, and your data is a file you own.\n\nWhat it doesn't do is team features. There's no shared workspace, no seats, no approvals; it's built for one person tracking their own hours.",
  },
  {
    question: "Does trackly work offline?",
    answer:
      "Always. There is no server and no network call in normal use — every command reads and writes a local SQLite database. The only thing that needs the internet is installing it from npm.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "In `~/.config/trackly/trackly.db`, with settings alongside it in `config.toml`. Set the `TRACKLY_CONFIG_DIR` environment variable to point the whole thing somewhere else — handy for keeping a separate profile, or for trying commands without touching your real hours.",
  },
  {
    question: "Can I sync my time entries between two computers?",
    answer:
      "You can point the database at a synced folder (`tck config set db-path ~/Dropbox/trackly.db`). trackly deliberately uses SQLite's `DELETE` journal mode instead of WAL so there are no side files for a sync client to mangle.\n\nOne caveat worth respecting: don't run commands on two machines at once against the same synced file. There's no conflict resolution — last write wins, like any file in a synced folder.",
  },
  {
    question: "How do I export my hours to PDF or CSV?",
    answer:
      "`tck report pdf --this-month -o report.pdf` for a PDF with charts, `tck export csv --last-month -o hours.csv` for a flat spreadsheet-ready file. Both take the same date shortcuts and filters, so whatever you can see on screen you can export.\n\nThere's also `tck report chart`, which draws the same data as bar charts right in the terminal when you just want a look.",
  },
  {
    question: "Can I invoice a client from my tracked time?",
    answer:
      "Yes — `tck invoice pdf --client \"Acme Corp\" --last-month -o invoice.pdf` prices every billable hour at its own rate, applies tax, and numbers the invoice from a template you configure once with `tck invoice config set`. Non-billable entries are always excluded.",
  },
  {
    question: "What happens to past entries when I raise my hourly rate?",
    answer:
      "Nothing — and that's deliberate. Every entry freezes the rate it resolved to (project rate, falling back to the workspace default) the moment it's created, so `tck rate set` only affects work tracked from then on. You'll never accidentally re-bill last quarter at this quarter's price.",
  },
  {
    question: "How do I track time for several clients?",
    answer:
      "Create one workspace per client with `tck workspace create`, and switch between them with `tck workspace switch`. Projects, tags and entries never leak across workspaces.\n\nIf one client owns several projects, tag the projects with `--client` instead and use `--client` on reports, exports, invoices and earnings to slice across all of them at once.",
  },
  {
    question: "How do I find an entry when I only half-remember what I wrote?",
    answer:
      "Use `--search`: `tck list --search \"checkout bug\"` matches any description containing every word you gave, in any order. It ignores case and accents, so `sesion` finds \"sesión\".\n\nIt combines with every other filter and works on `tck list`, reports, exports and invoices.",
  },
  {
    question: "Can an AI assistant like Claude manage my time tracking?",
    answer:
      "That's what `tck mcp` is for: it starts a [Model Context Protocol](https://modelcontextprotocol.io) server exposing the same operations as MCP tools, so Claude Desktop or Claude Code can start timers, log entries and pull reports on your behalf. The data still lives only on your machine.",
  },
  {
    question: "Does trackly run on Windows?",
    answer:
      "It runs anywhere Node.js 20+ runs — macOS, Linux and Windows. Installation is the same `npm install -g @tonyakitori/trackly` everywhere, and there's nothing to compile: even the charts in the PDFs are hand-built SVG rather than a native rendering library.",
  },
  {
    question: "How do I back up or move my data?",
    answer:
      "`tck backup -o ./backups` writes two things at once: a byte-for-byte copy of the database and a plain-text SQL dump. The dump is diffable and survives a corrupted SQLite file, which a binary copy alone would not. `tck restore` reads either one back.",
  },
  {
    question: "Is trackly free and open source?",
    answer:
      "Yes, MIT licensed. The source is on [GitHub](https://github.com/AntonioHReyes/trackly) and the package on [npm](https://www.npmjs.com/package/@tonyakitori/trackly).",
  },
];
