import { TomlStore } from "./TomlStore.js";
import { configFilePath } from "./paths.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import {
  Rounding,
  ROUNDING_MODES,
  type RoundingMode,
} from "../../domain/value-objects/Rounding.js";

export type { WeekStart };

export interface ConfigValues {
  /** Overrides the default `~/.config/trackly/trackly.db` location. */
  dbPath: string | undefined;
  /** Affects `--this-week`/`--last-week` report shortcuts. */
  weekStart: WeekStart;
  /** Default duration rounding applied to reports and exports. */
  rounding: Rounding;
  /** Whether `tck git-hook attach` stops the running entry it tags (default: off, tag only). */
  gitHookStopsTimer: boolean;
}

const DEFAULT_WEEK_START: WeekStart = "monday";
const DEFAULT_ROUNDING_MINUTES = 15;
const DEFAULT_GIT_HOOK_STOPS_TIMER = false;

/** Persists user-configurable settings (`tck config set/get`) as TOML. */
export class ConfigStore {
  private readonly toml: TomlStore;

  constructor(filePath: string = configFilePath()) {
    this.toml = new TomlStore(filePath);
  }

  read(): ConfigValues {
    const raw = this.toml.read();
    const dbPath = raw["db-path"];
    const weekStart = raw["week-start"];
    return {
      dbPath: typeof dbPath === "string" ? dbPath : undefined,
      weekStart: weekStart === "sunday" ? "sunday" : DEFAULT_WEEK_START,
      rounding: ConfigStore.readRounding(raw),
      gitHookStopsTimer: raw["git-hook-stops-timer"] === true ? true : DEFAULT_GIT_HOOK_STOPS_TIMER,
    };
  }

  setDbPath(path: string): void {
    this.toml.update({ "db-path": path });
  }

  setWeekStart(weekStart: WeekStart): void {
    this.toml.update({ "week-start": weekStart });
  }

  setRoundingMode(mode: RoundingMode): void {
    this.toml.update({ rounding: mode });
  }

  setRoundingMinutes(minutes: number): void {
    // Validate through the value object so an invalid increment can never
    // reach the file, whichever mode happens to be stored right now.
    Rounding.of("nearest", minutes);
    this.toml.update({ "rounding-minutes": minutes });
  }

  setGitHookStopsTimer(stops: boolean): void {
    this.toml.update({ "git-hook-stops-timer": stops });
  }

  /**
   * Unreadable or out-of-range values degrade to the defaults rather than
   * throwing: a hand-edited config file should never brick every command.
   */
  private static readRounding(raw: Record<string, string | number | boolean>): Rounding {
    const mode = raw["rounding"];
    const minutes = raw["rounding-minutes"];
    if (typeof mode !== "string" || !ROUNDING_MODES.includes(mode as RoundingMode)) {
      return Rounding.none();
    }
    const increment =
      typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0
        ? minutes
        : DEFAULT_ROUNDING_MINUTES;
    return Rounding.of(mode as RoundingMode, increment);
  }
}
