import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * A deliberately minimal TOML reader/writer: flat `key = "value"` /
 * `key = 123` / `key = true` pairs only, no tables or arrays. Trackly's
 * config and state files (see SPEC.md's "Storage / sync" section) never
 * need more than that, so a real TOML dependency would be pure overhead.
 */
export class TomlStore {
  constructor(private readonly filePath: string) {}

  read(): Record<string, string | number | boolean> {
    if (!existsSync(this.filePath)) return {};
    const values: Record<string, string | number | boolean> = {};
    for (const line of readFileSync(this.filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const match = /^([\w.-]+)\s*=\s*(.+)$/.exec(trimmed);
      if (!match) continue;
      const [, key, rawValue] = match as unknown as [string, string, string];
      values[key] = TomlStore.parseValue(rawValue.trim());
    }
    return values;
  }

  write(values: Record<string, string | number | boolean>): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const lines = Object.entries(values).map(
      ([key, value]) => `${key} = ${TomlStore.formatValue(value)}`,
    );
    writeFileSync(this.filePath, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf8");
  }

  /** Reads, applies `patch` on top of the existing values, and writes back. */
  update(patch: Record<string, string | number | boolean>): void {
    this.write({ ...this.read(), ...patch });
  }

  /** Drops `key` from the file; a no-op when it isn't set. */
  remove(key: string): void {
    const values = this.read();
    delete values[key];
    this.write(values);
  }

  private static parseValue(raw: string): string | number | boolean {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
    return raw;
  }

  private static formatValue(value: string | number | boolean): string {
    return typeof value === "string" ? `"${value}"` : String(value);
  }
}
