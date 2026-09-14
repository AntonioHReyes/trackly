import type { Command, Option } from "commander";
import type { FaqEntry } from "./faq.js";

const SITE_URL = "https://antoniohreyes.github.io/trackly/";
const DOCS_URL = `${SITE_URL}docs/`;
const REPO_URL = "https://github.com/AntonioHReyes/trackly";
const NPM_URL = "https://www.npmjs.com/package/@tonyakitori/trackly";
const COFFEE_URL = "https://buymeacoffee.com/anhr9728w";

interface OptionDoc {
  flags: string;
  description: string;
}

interface CommandDoc {
  /** "invoice pdf" — how a user types it, minus the `tck`. */
  path: string;
  anchor: string;
  usage: string;
  description: string;
  options: OptionDoc[];
}

export interface DocsInput {
  program: Command;
  faq: readonly FaqEntry[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `code` and [text](url) only — everything else is escaped, never trusted. */
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderParagraphs(text: string): string {
  return text
    .split("\n\n")
    .map((paragraph) => `<p>${renderInline(paragraph)}</p>`)
    .join("\n        ");
}

/** The FAQ answer as search engines want it: plain text, no markup. */
function plainText(text: string): string {
  return text.replace(/`/g, "").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

function optionDocs(command: Command): OptionDoc[] {
  return command.options.map((option: Option) => ({
    flags: option.flags,
    description: option.description,
  }));
}

/** `<name>` for required arguments, `[name]` for optional ones. */
function argumentSignature(command: Command): string {
  return command.registeredArguments
    .map((argument) => {
      const name = argument.variadic ? `${argument.name()}...` : argument.name();
      return argument.required ? `<${name}>` : `[${name}]`;
    })
    .join(" ");
}

/**
 * Flattens the Commander tree depth-first, keeping registration order so
 * the page reads in the order the CLI was designed, not alphabetically.
 */
function collectCommands(command: Command, parents: string[] = []): CommandDoc[] {
  const docs: CommandDoc[] = [];

  for (const child of command.commands) {
    const path = [...parents, child.name()].join(" ");
    const args = argumentSignature(child);
    const options = optionDocs(child);
    docs.push({
      path,
      anchor: `tck-${path.replace(/\s+/g, "-")}`,
      usage: ["tck", path, args, options.length > 0 ? "[options]" : ""]
        .filter((part) => part.length > 0)
        .join(" "),
      description: child.description(),
      options,
    });
    docs.push(...collectCommands(child, [...parents, child.name()]));
  }

  return docs;
}

function renderOptionsTable(options: OptionDoc[]): string {
  if (options.length === 0) return "";
  const rows = options
    .map(
      (option) =>
        `          <tr><td><code>${escapeHtml(option.flags)}</code></td><td>${escapeHtml(
          option.description,
        )}</td></tr>`,
    )
    .join("\n");
  return `
        <table class="opts">
          <thead><tr><th>Flag</th><th>What it does</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>`;
}

function renderCommand(doc: CommandDoc): string {
  return `      <article class="cmd-block" id="${doc.anchor}">
        <h3><a class="self" href="#${doc.anchor}">tck ${escapeHtml(doc.path)}</a></h3>
        <p class="desc">${escapeHtml(doc.description)}</p>
        <pre class="usage">${escapeHtml(doc.usage)}</pre>${renderOptionsTable(doc.options)}
      </article>`;
}

function renderToc(docs: CommandDoc[]): string {
  return docs
    .map((doc) => `        <li><a href="#${doc.anchor}">tck ${escapeHtml(doc.path)}</a></li>`)
    .join("\n");
}

function renderFaq(faq: readonly FaqEntry[]): string {
  return faq
    .map(
      (entry, index) => `      <article class="faq-item" id="faq-${index + 1}">
        <h3>${escapeHtml(entry.question)}</h3>
        ${renderParagraphs(entry.answer)}
      </article>`,
    )
    .join("\n");
}

function faqJsonLd(faq: readonly FaqEntry[]): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: plainText(entry.answer) },
      })),
    },
    null,
    2,
  );
}

// Deliberately carries no version number: the release workflow bumps
// package.json without regenerating this page, so anything version-shaped
// baked in here would be stale the moment it's published. The npm badge in
// the header shows the current version instead, resolved at page load.
function softwareJsonLd(): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "trackly",
      alternateName: "tck",
      description:
        "A local-first, Toggl-style time-tracking CLI with workspaces, projects, rates, PDF/CSV reports, PDF invoices, and a built-in MCP server for AI assistants.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      url: DOCS_URL,
      downloadUrl: NPM_URL,
      codeRepository: REPO_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    null,
    2,
  );
}

const STYLES = `  :root {
    --bg: #0d1117;
    --bg-alt: #11161d;
    --border: #22282f;
    --fg: #e6edf3;
    --fg-dim: #8b949e;
    --accent: #58f2a0;
    --accent-dim: #2f7d5c;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code, pre, .mono { font-family: var(--mono); }
  .wrap { max-width: 880px; margin: 0 auto; padding: 0 24px; }

  header.top {
    padding: 56px 0 32px;
    border-bottom: 1px solid var(--border);
    background:
      radial-gradient(600px 300px at 20% -10%, rgba(88,242,160,.08), transparent),
      var(--bg);
  }
  .crumb { font-family: var(--mono); font-size: 13px; color: var(--fg-dim); margin-bottom: 18px; }
  h1 { font-size: clamp(28px, 4vw, 40px); margin: 0 0 12px; letter-spacing: -0.02em; }
  h1 .cmd { color: var(--accent); font-family: var(--mono); }
  .lede { font-size: 18px; color: var(--fg-dim); max-width: 640px; margin: 0; }
  .version { font-family: var(--mono); font-size: 13px; color: var(--fg-dim); margin-top: 14px; }
  .version .badge-img { height: 16px; vertical-align: -3px; }

  section { padding: 48px 0; border-bottom: 1px solid var(--border); }
  section:last-of-type { border-bottom: none; }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--accent);
    margin: 0 0 24px;
  }

  pre.usage, pre.install {
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    margin: 0 0 16px;
    overflow-x: auto;
    font-size: 13.5px;
    color: #d5dbe2;
  }

  ul.toc {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 6px 20px;
    font-family: var(--mono);
    font-size: 13.5px;
  }

  .cmd-block { padding: 24px 0; border-top: 1px solid var(--border); }
  .cmd-block h3 { font-family: var(--mono); font-size: 17px; margin: 0 0 6px; }
  .cmd-block h3 a.self { color: var(--fg); }
  .cmd-block .desc { margin: 0 0 14px; color: var(--fg-dim); }

  table.opts { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.opts th {
    text-align: left;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--fg-dim);
    border-bottom: 1px solid var(--border);
    padding: 6px 12px 6px 0;
  }
  table.opts td { padding: 8px 12px 8px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
  table.opts td:first-child { white-space: nowrap; color: var(--accent); }
  table.opts code { font-size: 13px; }

  .faq-item { padding: 20px 0; border-top: 1px solid var(--border); }
  .faq-item h3 { font-size: 17px; margin: 0 0 8px; }
  .faq-item p { margin: 0 0 10px; color: var(--fg-dim); }
  .faq-item p:last-child { margin-bottom: 0; }

  footer {
    padding: 32px 0 64px;
    color: var(--fg-dim);
    font-size: 13px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
  }
  footer a { color: var(--fg-dim); }
  footer a:hover { color: var(--accent); }`;

/**
 * Renders the whole docs page. Pure and deterministic — same program and
 * FAQ in, same bytes out — which is what lets a test catch a stale
 * `site/docs/index.html` instead of trusting everyone to regenerate it.
 */
export function renderDocs({ program, faq }: DocsInput): string {
  const commands = collectCommands(program);
  const globalOptions = optionDocs(program);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>trackly docs — every tck command, flag and FAQ</title>
<meta name="description" content="Full command reference for tck, the local-first time-tracking CLI: timers, projects, clients, rates, reports, invoices, MCP server — plus answers to the questions people ask before installing." />
<meta name="keywords" content="tck commands, trackly documentation, time tracking cli manual, tck cli reference, toggl alternative cli, terminal time tracker faq" />
<link rel="canonical" href="${DOCS_URL}" />
<meta name="robots" content="index, follow" />
<meta name="author" content="Antonio Huerta Reyes" />

<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:title" content="trackly docs — every tck command, flag and FAQ" />
<meta property="og:description" content="The complete tck command reference, generated from the CLI itself, plus a FAQ about local-first time tracking." />
<meta property="og:url" content="${DOCS_URL}" />
<meta property="og:image" content="${SITE_URL}og-image.svg" />
<meta property="og:site_name" content="trackly" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="trackly docs — every tck command, flag and FAQ" />
<meta name="twitter:description" content="The complete tck command reference, generated from the CLI itself, plus a FAQ about local-first time tracking." />
<meta name="twitter:image" content="${SITE_URL}og-image.svg" />

<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%230d1117%22/><text x=%2250%22 y=%2268%22 font-size=%2258%22 text-anchor=%22middle%22 fill=%22%2358f2a0%22 font-family=%22monospace%22>&gt;_</text></svg>" />

<script type="application/ld+json">
${softwareJsonLd()}
</script>

<script type="application/ld+json">
${faqJsonLd(faq)}
</script>

<style>
${STYLES}
</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <p class="crumb"><a href="../">trackly</a> / docs</p>
    <h1>Every <span class="cmd">tck</span> command, in one page</h1>
    <p class="lede">
      The reference below is generated from the CLI itself, so it lists exactly
      the commands and flags your installed <code>tck</code> accepts — nothing
      invented, nothing forgotten.
    </p>
    <p class="version"><img class="badge-img" src="https://img.shields.io/npm/v/%40tonyakitori%2Ftrackly?style=flat-square&amp;label=&amp;color=58f2a0" alt="current version on npm" /> · <a href="${REPO_URL}">source on GitHub</a></p>
  </div>
</header>

<section id="install">
  <div class="wrap">
    <h2>Install</h2>
    <pre class="install">npm install -g @tonyakitori/trackly
tck --version</pre>
    <p class="lede">Requires Node.js 20 or newer. The binary is called <code>tck</code>.</p>
  </div>
</section>

<section id="global-options">
  <div class="wrap">
    <h2>Global options</h2>
    <p class="lede">Accepted by every command.</p>${renderOptionsTable(globalOptions)}
  </div>
</section>

<section id="commands">
  <div class="wrap">
    <h2>Command reference</h2>
    <ul class="toc">
${renderToc(commands)}
    </ul>
${commands.map(renderCommand).join("\n")}
  </div>
</section>

<section id="faq">
  <div class="wrap">
    <h2>Frequently asked questions</h2>
${renderFaq(faq)}
  </div>
</section>

<footer>
  <div class="wrap" style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; width:100%;">
    <span>&copy; 2026 Antonio Huerta Reyes &middot; MIT License</span>
    <span>
      <a href="../">Home</a>
      &middot;
      <a href="${REPO_URL}">GitHub</a>
      &middot;
      <a href="${NPM_URL}">npm</a>
      &middot;
      <a href="${COFFEE_URL}" rel="noopener">Buy me a coffee</a>
    </span>
  </div>
</footer>

</body>
</html>
`;
}
