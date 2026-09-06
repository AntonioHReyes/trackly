import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PdfInvoiceExporter } from "../../../src/infrastructure/reporting/PdfInvoiceExporter.js";
import { InvoiceService } from "../../../src/application/services/InvoiceService.js";
import { ReportService } from "../../../src/application/services/ReportService.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { InvoiceDetails } from "../../../src/domain/value-objects/InvoiceDetails.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";

describe("PdfInvoiceExporter", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes a non-empty PDF starting with the %PDF magic header", async () => {
    dir = await mkdtemp(join(tmpdir(), "trackly-invoice-"));
    const entries = new InMemoryTimeEntryRepository();
    const projects = new InMemoryProjectRepository();
    const tags = new InMemoryTagRepository();
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    const project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 75 });
    await projects.save(project);
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Build homepage",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T13:00:00Z"),
        projectId: project.id,
      }),
    );

    const invoiceService = new InvoiceService(new ReportService(entries, projects, tags));
    const details = InvoiceDetails.create({
      number: "INV-2026-001",
      billTo: "Acme Corp\n123 Main St",
      taxRate: 21,
      notes: "Thanks for the business.",
    });
    const data = await invoiceService.build(workspace, { workspaceId: workspace.id }, details);

    const outPath = join(dir, "invoice.pdf");
    await new PdfInvoiceExporter().export(data, outPath);

    const stats = await stat(outPath);
    expect(stats.size).toBeGreaterThan(0);
    const header = await readFile(outPath, { encoding: "latin1", flag: "r" });
    expect(header.startsWith("%PDF-")).toBe(true);
  });
});
