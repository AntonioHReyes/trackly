import type { Command } from "commander";
import type { Container } from "../container.js";
import { ValidationError } from "../../domain/errors/DomainError.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import { ROUNDING_MODES, type RoundingMode } from "../../domain/value-objects/Rounding.js";
import * as ui from "../ui/index.js";

const CONFIG_KEYS = [
  "db-path",
  "week-start",
  "rounding",
  "rounding-minutes",
  "git-hook-stops-timer",
] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

function assertKnownKey(key: string): asserts key is ConfigKey {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    throw new ValidationError(`Unknown config key "${key}". Known keys: ${CONFIG_KEYS.join(", ")}`);
  }
}

function assertWeekStart(value: string): asserts value is WeekStart {
  if (value !== "monday" && value !== "sunday") {
    throw new ValidationError(`week-start must be "monday" or "sunday", got "${value}"`);
  }
}

function assertRoundingMode(value: string): asserts value is RoundingMode {
  if (!ROUNDING_MODES.includes(value as RoundingMode)) {
    throw new ValidationError(
      `rounding must be one of ${ROUNDING_MODES.join(", ")}, got "${value}"`,
    );
  }
}

function parseRoundingMinutes(value: string): number {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) {
    throw new ValidationError(`rounding-minutes must be a whole number, got "${value}"`);
  }
  return minutes;
}

function parseBoolean(key: string, value: string): boolean {
  if (value !== "true" && value !== "false") {
    throw new ValidationError(`${key} must be "true" or "false", got "${value}"`);
  }
  return value === "true";
}

/** `tck config set/get` (see SPEC.md's Config command). */
export function registerConfigCommands(program: Command, container: Container): void {
  const config = program.command("config").description("Read/write user configuration");

  config
    .command("set <key> <value>")
    .description(`Set a config value (keys: ${CONFIG_KEYS.join(", ")})`)
    .action((key: string, value: string) => {
      assertKnownKey(key);
      switch (key) {
        case "db-path":
          container.configStore.setDbPath(value);
          break;
        case "week-start":
          assertWeekStart(value);
          container.configStore.setWeekStart(value);
          break;
        case "rounding":
          assertRoundingMode(value);
          container.configStore.setRoundingMode(value);
          break;
        case "rounding-minutes":
          container.configStore.setRoundingMinutes(parseRoundingMinutes(value));
          break;
        case "git-hook-stops-timer":
          container.configStore.setGitHookStopsTimer(parseBoolean(key, value));
          break;
      }
      ui.success(`${ui.em(key)} = ${ui.cyan(value)}`);
    });

  config
    .command("get [key]")
    .description("Print a config value, or all of them if omitted")
    .action((key?: string) => {
      const values = container.configStore.read();
      const displayed: Record<ConfigKey, string> = {
        "db-path": values.dbPath ?? "(default)",
        "week-start": values.weekStart,
        rounding: values.rounding.mode,
        "rounding-minutes": String(values.rounding.minutes),
        "git-hook-stops-timer": String(values.gitHookStopsTimer),
      };
      if (key === undefined) {
        ui.heading("Config");
        ui.print(
          ui.renderTable(
            ["Key", "Value"],
            Object.entries(displayed).map(([k, v]) => [k, v === "(default)" ? ui.dim(v) : ui.cyan(v)]),
          ),
        );
        return;
      }
      assertKnownKey(key);
      ui.print(displayed[key]);
    });
}
