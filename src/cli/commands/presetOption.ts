import type { Command } from "commander";
import { ValidationError } from "../../domain/errors/DomainError.js";
import type { ReportPresetStore } from "../../infrastructure/config/ReportPresetStore.js";

export interface PresetCliOptions {
  preset?: string;
}

/** Adds `--preset <name>` — shared by `report pdf`, `export csv`, and `invoice pdf`. */
export function addPresetOption(command: Command): Command {
  return command.option(
    "--preset <name>",
    "load saved filter flags from a report preset; explicit flags override",
  );
}

/**
 * Merges a saved preset's flags under the explicitly-passed ones — a flag
 * typed on the command line always wins over what a preset stored, so a
 * one-off override never requires re-saving the preset.
 */
export function applyPreset<T extends PresetCliOptions>(options: T, store: ReportPresetStore): T {
  if (!options.preset) return options;
  const saved = store.get(options.preset);
  if (!saved) {
    throw new ValidationError(
      `No report preset named "${options.preset}". Run \`tck report preset list\`.`,
    );
  }
  return { ...saved, ...stripUndefined(options) } as unknown as T;
}

function stripUndefined<T extends object>(options: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
