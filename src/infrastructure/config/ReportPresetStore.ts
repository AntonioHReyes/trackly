import { JsonStore } from "./JsonStore.js";
import { reportPresetsFilePath } from "./paths.js";
import { ValidationError } from "../../domain/errors/DomainError.js";

/** A saved set of parsed CLI flags, keyed by the same option names commander produces. */
export type PresetFlags = Record<string, string | boolean>;

/**
 * Persists named filter presets shared by `report pdf`, `export csv`, and
 * `invoice pdf` (`tck report preset save/list/rm`, `--preset <name>`) — a
 * flat name→flags map, so there's no schema beyond "whatever flags were
 * passed to `save`".
 */
export class ReportPresetStore {
  private readonly json: JsonStore<Record<string, PresetFlags>>;

  constructor(filePath: string = reportPresetsFilePath()) {
    this.json = new JsonStore(filePath, {});
  }

  list(): Record<string, PresetFlags> {
    return this.json.read();
  }

  get(name: string): PresetFlags | undefined {
    return this.json.read()[name];
  }

  save(name: string, flags: PresetFlags): void {
    this.json.update({ [name]: flags });
  }

  remove(name: string): void {
    const all = this.json.read();
    if (!(name in all)) {
      throw new ValidationError(`No report preset named "${name}"`);
    }
    const rest = { ...all };
    delete rest[name];
    this.json.write(rest);
  }
}
