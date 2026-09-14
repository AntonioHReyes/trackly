import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { docsPage } from "../../scripts/docs/buildDocsPage.js";
import { FAQ } from "../../scripts/docs/faq.js";

const COMMITTED_PAGE = join(process.cwd(), "site", "docs", "index.html");

describe("docs page", () => {
  let scratchDir: string;
  let html: string;

  beforeAll(() => {
    scratchDir = mkdtempSync(join(tmpdir(), "trackly-docs-test-"));
    process.env["TRACKLY_CONFIG_DIR"] = scratchDir;
    html = docsPage();
  });

  afterAll(() => {
    delete process.env["TRACKLY_CONFIG_DIR"];
    rmSync(scratchDir, { recursive: true, force: true });
  });

  // The whole point of generating the page: it can't quietly fall behind
  // the CLI. Regenerate with `pnpm docs:build` when this fails.
  it("matches the committed site/docs/index.html", () => {
    expect(html).toBe(readFileSync(COMMITTED_PAGE, "utf-8"));
  });

  it("documents commands and their flags straight from Commander", () => {
    expect(html).toContain('id="tck-list"');
    expect(html).toContain('id="tck-invoice-pdf"');
    expect(html).toContain("--search &lt;text&gt;");
    expect(html).toContain("--workspace &lt;slug&gt;");
  });

  it("publishes every FAQ entry as structured data", () => {
    for (const entry of FAQ) {
      expect(html).toContain(entry.question);
    }
    expect(html).toContain('"@type": "FAQPage"');
  });

  it("escapes flag placeholders instead of emitting raw markup", () => {
    expect(html).not.toMatch(/<td><code>[^<]*<(?!\/code>)/);
  });
});
