import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";
import { ValidationError } from "../../domain/errors/DomainError.js";
import { addReportFilterOptions, type ReportFilterOptions } from "./reportOptions.js";

/**
 * `tck report preset save/list/rm` — named, reusable filter flags for
 * `report pdf`, `export csv`, and `invoice pdf` (`--preset <name>`).
 */
export function registerReportPresetCommands(report: Command, container: Container): void {
  const preset = report.command("preset").description("Manage saved report filter presets");

  addReportFilterOptions(preset.command("save <name>"))
    .description("Save the given filter flags under a name")
    .action((name: string, options: ReportFilterOptions) => {
      const flags = stripUndefined(options);
      if (Object.keys(flags).length === 0) {
        throw new ValidationError("Refusing to save an empty preset — pass at least one filter flag");
      }
      container.reportPresetStore.save(name, flags);
      ui.success(`Saved preset ${ui.code(name)}`);
    });

  preset
    .command("list")
    .description("List saved report presets")
    .action(() => {
      const all = container.reportPresetStore.list();
      const names = Object.keys(all);
      if (names.length === 0) {
        ui.empty("No saved presets.", "tck report preset save <name> --this-month ...");
        return;
      }
      ui.print(ui.renderTable(["Name", "Flags"], names.map((name) => [name, describeFlags(all[name]!)])));
    });

  preset
    .command("rm <name>")
    .description("Delete a saved report preset")
    .action((name: string) => {
      container.reportPresetStore.remove(name);
      ui.success(`Removed preset ${ui.code(name)}`);
    });
}

function stripUndefined(options: ReportFilterOptions): Record<string, string | boolean> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as Record<string, string | boolean>;
}

function describeFlags(flags: Record<string, string | boolean>): string {
  return Object.entries(flags)
    .map(([key, value]) => (value === true ? `--${kebab(key)}` : `--${kebab(key)}=${String(value)}`))
    .join(" ");
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
