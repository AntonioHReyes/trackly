import { describe, it, expect, beforeEach } from "vitest";
import { InvoiceService } from "../../../src/application/services/InvoiceService.js";
import { ReportService } from "../../../src/application/services/ReportService.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { InvoiceDetails } from "../../../src/domain/value-objects/InvoiceDetails.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";

describe("InvoiceService", () => {
  let entries: InMemoryTimeEntryRepository;
  let projects: InMemoryProjectRepository;
  let service: InvoiceService;
  let workspace: Workspace;
  let project: Project;

  beforeEach(async () => {
    entries = new InMemoryTimeEntryRepository();
    projects = new InMemoryProjectRepository();
    const tags = new InMemoryTagRepository();
    service = new InvoiceService(new ReportService(entries, projects, tags));

    workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 50 });
    await projects.save(project);
  });

  it("prices billable hours by project and applies tax to the subtotal", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Build homepage",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T11:00:00Z"),
        projectId: project.id,
      }),
    );
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Internal chat",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
        billable: false,
      }),
    );

    const details = InvoiceDetails.create({ number: "INV-1", taxRate: 20 });
    const invoice = await service.build(workspace, { workspaceId: workspace.id }, details);

    expect(invoice.lineItems).toEqual([
      expect.objectContaining({ projectName: "Website", hours: 2, amount: expect.anything() }),
    ]);
    expect(invoice.subtotal.toDecimal()).toBeCloseTo(100); // 2h * $50
    expect(invoice.taxAmount.toDecimal()).toBeCloseTo(20); // 20% of 100
    expect(invoice.total.toDecimal()).toBeCloseTo(120);
    expect(invoice.unbilledHours).toBe(0);
  });

  it("excludes billable hours with no resolvable rate from line items", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "No-rate work",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
      }),
    );

    const details = InvoiceDetails.create({ number: "INV-2" });
    const invoice = await service.build(workspace, { workspaceId: workspace.id }, details);

    expect(invoice.lineItems).toEqual([]);
    expect(invoice.unbilledHours).toBeCloseTo(1);
    expect(invoice.subtotal.toDecimal()).toBe(0);
  });

  it("splits a project's billable hours into priced and unbilled when rates mix", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Priced before the project ever had a rate",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
        projectId: project.id,
        rate: 30,
      }),
    );
    await projects.save(project.withUpdates({ hourlyRate: null }));
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Tracked while the project had no rate",
        startTs: new Date("2026-01-02T09:00:00Z"),
        endTs: new Date("2026-01-02T10:00:00Z"),
        projectId: project.id,
      }),
    );

    const details = InvoiceDetails.create({ number: "INV-4" });
    const invoice = await service.build(workspace, { workspaceId: workspace.id }, details);

    expect(invoice.lineItems).toEqual([
      expect.objectContaining({ projectName: "Website", hours: 1, rate: expect.anything() }),
    ]);
    expect(invoice.subtotal.toDecimal()).toBeCloseTo(30);
    expect(invoice.unbilledHours).toBeCloseTo(1);
  });

  it("ignores non-billable entries entirely, even if the caller's filter doesn't", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Internal",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
        projectId: project.id,
        billable: false,
      }),
    );

    const details = InvoiceDetails.create({ number: "INV-3" });
    const invoice = await service.build(
      workspace,
      { workspaceId: workspace.id, billable: false },
      details,
    );

    expect(invoice.lineItems).toEqual([]);
    expect(invoice.subtotal.toDecimal()).toBe(0);
  });
});
