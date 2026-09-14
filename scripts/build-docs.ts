import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { docsPage } from "./docs/buildDocsPage.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(projectRoot, "site", "docs", "index.html");

// A throwaway config dir keeps the generator away from the real database:
// building the command tree constructs the container, which opens SQLite.
const scratchDir = mkdtempSync(join(tmpdir(), "trackly-docs-"));
process.env["TRACKLY_CONFIG_DIR"] = scratchDir;

try {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, docsPage(), "utf-8");
  console.log(`Wrote ${outputPath}`);
} finally {
  rmSync(scratchDir, { recursive: true, force: true });
}
