#!/usr/bin/env node
import { Container } from "./container.js";
import { buildProgram } from "./program.js";
import { DomainError } from "../domain/errors/DomainError.js";
import * as ui from "./ui/index.js";

// Composition root and feature commands are wired in here as each phase
// lands (see PLAN.md). Kept deliberately empty otherwise — this file's only
// job is bootstrapping the CLI, never business logic.
async function main(): Promise<void> {
  const container = new Container();
  const program = buildProgram(container);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof DomainError) {
      ui.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    container.close();
  }
}

void main();
