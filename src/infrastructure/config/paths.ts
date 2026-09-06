import { homedir } from "node:os";
import { join } from "node:path";

/**
 * All trackly state lives under one config directory, overridable via
 * `TRACKLY_CONFIG_DIR` so tests (and anyone running multiple profiles) never
 * touch the real `~/.config/trackly`.
 */
export function configDir(): string {
  return process.env["TRACKLY_CONFIG_DIR"] ?? join(homedir(), ".config", "trackly");
}

export function configFilePath(): string {
  return join(configDir(), "config.toml");
}

export function stateFilePath(): string {
  return join(configDir(), "state.toml");
}

/** Default DB location; overridable via `tck config set db-path ...`. */
export function defaultDbPath(): string {
  return join(configDir(), "trackly.db");
}

export function defaultBackupDir(): string {
  return join(configDir(), "backups");
}

/** Named `report pdf`/`export csv` filter presets (`tck report preset ...`). */
export function reportPresetsFilePath(): string {
  return join(configDir(), "report-presets.json");
}

/** Persisted invoice defaults and numbering counter (`tck invoice config ...`). */
export function invoiceConfigFilePath(): string {
  return join(configDir(), "invoice.json");
}
