import type { Command } from "commander";
import { ValidationError } from "../../domain/errors/DomainError.js";
import {
  Rounding,
  ROUNDING_MODES,
  type RoundingMode,
} from "../../domain/value-objects/Rounding.js";
import type { ConfigValues } from "../../infrastructure/config/ConfigStore.js";

export interface RoundingCliOptions {
  rounding?: string;
  roundingMinutes?: string;
}

/** Adds the shared `--rounding`/`--rounding-minutes` flags to a command. */
export function addRoundingOptions(command: Command): Command {
  return command
    .option(
      "--rounding <mode>",
      `round each entry's duration: ${ROUNDING_MODES.join(" | ")} (default: config rounding)`,
    )
    .option(
      "--rounding-minutes <minutes>",
      "rounding increment in minutes, e.g. 6, 15, 30 (default: config rounding-minutes)",
    );
}

/**
 * Resolves the rounding to apply: explicit flags win over the stored
 * `config set rounding`, so a one-off report can round differently without
 * changing the user's defaults.
 */
export function resolveRounding(options: RoundingCliOptions, config: ConfigValues): Rounding {
  const minutes = options.roundingMinutes
    ? parseMinutes(options.roundingMinutes)
    : config.rounding.minutes;
  if (options.rounding) {
    return Rounding.of(parseMode(options.rounding), minutes);
  }
  // Asking for an increment but no mode reads as "round to this" — fall back
  // to `nearest` instead of silently ignoring the flag.
  const mode = config.rounding.isEnabled
    ? config.rounding.mode
    : options.roundingMinutes
      ? "nearest"
      : "none";
  return Rounding.of(mode, minutes);
}

function parseMode(value: string): RoundingMode {
  if (!ROUNDING_MODES.includes(value as RoundingMode)) {
    throw new ValidationError(
      `--rounding must be one of ${ROUNDING_MODES.join(", ")}, got "${value}"`,
    );
  }
  return value as RoundingMode;
}

function parseMinutes(value: string): number {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) {
    throw new ValidationError(`--rounding-minutes must be a whole number, got "${value}"`);
  }
  return minutes;
}
