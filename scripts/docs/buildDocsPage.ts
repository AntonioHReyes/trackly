import { Container } from "../../src/cli/container.js";
import { buildProgram, CLI_VERSION } from "../../src/cli/program.js";
import { renderDocs } from "./renderDocs.js";
import { FAQ } from "./faq.js";

/**
 * Builds the docs page from the live command tree. Callers must point
 * `TRACKLY_CONFIG_DIR` at a throwaway directory first — constructing the
 * container opens a SQLite database, and generating docs has no business
 * touching a real one.
 */
export function docsPage(): string {
  const container = new Container();
  try {
    return renderDocs({ program: buildProgram(container), version: CLI_VERSION, faq: FAQ });
  } finally {
    container.close();
  }
}
