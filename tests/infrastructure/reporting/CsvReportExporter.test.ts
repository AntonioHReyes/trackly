import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CsvReportExporter } from "../../../src/infrastructure/reporting/CsvReportExporter.js";
import { ReportService } from "../../../src/application/services/ReportService.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";

describe("CsvReportExporter", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes a flat CSV with one row per entry, quoting fields that need it", async () => {
    dir = await mkdtemp(join(tmpdir(), "trackly-csv-"));
    const entries = new InMemoryTimeEntryRepository();
    const projects = new InMemoryProjectRepository();
    const tags = new InMemoryTagRepository();
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    const project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 20 });
    await projects.save(project);

    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Fix, bug",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
        projectId: project.id,
      }),
    );

    const report = new ReportService(entries, projects, tags);
    const data = await report.build(workspace, { workspaceId: workspace.id });

    const outPath = join(dir, "export.csv");
    await new CsvReportExporter().export(data, outPath);

    const content = await readFile(outPath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines[0]).toBe(
      "id,description,project,tags,start,end,duration_hours,duration_hhmm,billable,amount,currency,commit",
    );
    expect(lines[1]).toContain('"Fix, bug"');
    expect(lines[1]).toContain("Website");
    expect(lines[1]).toContain("20.00");
    expect(lines[1]).toContain("01:00");
  });
});
