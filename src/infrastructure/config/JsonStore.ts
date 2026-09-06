import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * A generic JSON-file-backed store for config shapes `TomlStore` can't
 * express (named records, nested objects) — `ReportPresetStore` and
 * `InvoiceConfigStore` are both thin wrappers around one of these. A
 * corrupt or hand-edited file degrades to `defaultValue` rather than
 * throwing, matching `TomlStore`'s "never brick a command" stance.
 */
export class JsonStore<T extends object> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
  ) {}

  read(): T {
    if (!existsSync(this.filePath)) return this.defaultValue;
    try {
      return { ...this.defaultValue, ...(JSON.parse(readFileSync(this.filePath, "utf8")) as T) };
    } catch {
      return this.defaultValue;
    }
  }

  write(value: T): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  }

  /** Reads, shallow-merges `patch` on top, and writes back. */
  update(patch: Partial<T>): void {
    this.write({ ...this.read(), ...patch });
  }
}
