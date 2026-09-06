import { describe, it, expect, beforeEach } from "vitest";
import { ReportService } from "../../../src/application/services/ReportService.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { Tag } from "../../../src/domain/entities/Tag.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";
import { Rounding } from "../../../src/domain/value-objects/Rounding.js";
import { DateRange } from "../../../src/domain/value-objects/DateRange.js";

describe("ReportService", () => {
  let entries: InMemoryTimeEntryRepository;
  let projects: InMemoryProjectRepository;
  let tags: InMemoryTagRepository;
  let service: ReportService;
  let workspace: Workspace;
  let project: Project;
  let tag: Tag;

  beforeEach(async () => {
    entries = new InMemoryTimeEntryRepository();
    projects = new InMemoryProjectRepository();
    tags = new InMemoryTagRepository();
    service = new ReportService(entries, projects, tags);

    workspace = Workspace.create({
      slug: "acme",
      name: "Acme",
      currency: "USD",
      defaultHourlyRate: 10,
    });
    project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 50 });
    tag = Tag.create({ workspaceId: workspace.id, name: "urgent" });
    await projects.save(project);
    await tags.save(tag);
  });

  it("aggregates hours by day and by project", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "A",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T11:00:00Z"),
        projectId: project.id,
        tagIds: [tag.id],
      }),
    );
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "B",
        startTs: new Date("2026-01-02T09:00:00Z"),
        endTs: new Date("2026-01-02T10:00:00Z"),
      }),
    );

    const data = await service.build(workspace, { workspaceId: workspace.id });

    expect(data.totalHours).toBeCloseTo(3);
    expect(data.hoursByDay).toEqual([
      { date: "2026-01-01", hours: 2 },
      { date: "2026-01-02", hours: 1 },
    ]);
    expect(
      data.hoursByProject.map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        hours: p.hours,
      })),
    ).toEqual(
      expect.arrayContaining([
        { projectId: project.id, projectName: "Website", hours: 2 },
        { projectId: null, projectName: "(no project)", hours: 1 },
      ]),
    );
  });

  it("computes billable amounts using project rate overriding workspace default", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Billable via project rate",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T11:00:00Z"),
        projectId: project.id,
      }),
    );
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Billable via workspace default rate",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
      }),
    );
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Non-billable",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T10:00:00Z"),
        billable: false,
      }),
    );

    const data = await service.build(workspace, { workspaceId: workspace.id });

    // 2h * $50 (project rate) + 1h * $10 (workspace default) = $110.
    expect(data.billableAmount.toDecimal()).toBeCloseTo(110);
    expect(data.billableHours).toBeCloseTo(3);
    expect(data.nonBillableHours).toBeCloseTo(1);
  });

  it("resolves project and tag names for lookups", async () => {
    const entry = TimeEntry.addManual({
      workspaceId: workspace.id,
      description: "Tagged",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
      projectId: project.id,
      tagIds: [tag.id],
    });
    await entries.save(entry);

    const data = await service.build(workspace, { workspaceId: workspace.id });

    expect(data.projectNameById.get(project.id)).toBe("Website");
    expect(data.tagNameById.get(tag.id)).toBe("urgent");
    expect(data.amountByEntryId.get(entry.id)?.toDecimal()).toBeCloseTo(50);
  });

  it("rounds each entry's duration before aggregating", async () => {
    // 20 min and 40 min: rounded up to 15-min increments they become 30 + 45.
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Short",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T09:20:00Z"),
        projectId: project.id,
      }),
    );
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Longer",
        startTs: new Date("2026-01-01T10:00:00Z"),
        endTs: new Date("2026-01-01T10:40:00Z"),
        projectId: project.id,
      }),
    );

    const data = await service.build(
      workspace,
      { workspaceId: workspace.id },
      { rounding: Rounding.of("up", 15) },
    );

    expect(data.totalHours).toBeCloseTo(1.25);
    expect(data.billableAmount.toDecimal()).toBeCloseTo(62.5); // 1.25h * $50
    expect(data.filterLabel).toContain("rounded up 15 min");
  });

  it("keeps rounding out of the labels when the report hides it", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Short",
        startTs: new Date("2026-01-01T09:00:00Z"),
        endTs: new Date("2026-01-01T09:20:00Z"),
        projectId: project.id,
      }),
    );

    const data = await service.build(
      workspace,
      { workspaceId: workspace.id },
      { rounding: Rounding.of("up", 15), showRounding: false },
    );

    // Hidden in the wording only — the durations are still rounded.
    expect(data.filterLabel).not.toContain("rounded");
    expect(data.showRounding).toBe(false);
    expect(data.totalHours).toBeCloseTo(0.5);
  });

  it("fills days without entries when the report is bounded by a range", async () => {
    await entries.save(
      TimeEntry.addManual({
        workspaceId: workspace.id,
        description: "Only day",
        startTs: new Date(2026, 0, 2, 9),
        endTs: new Date(2026, 0, 2, 11),
      }),
    );

    const data = await service.build(workspace, {
      workspaceId: workspace.id,
      range: DateRange.of(new Date(2026, 0, 1), new Date(2026, 0, 4)),
    });

    expect(data.hoursByDay).toEqual([
      { date: "2026-01-01", hours: 0 },
      { date: "2026-01-02", hours: 2 },
      { date: "2026-01-03", hours: 0 },
    ]);
  });

  it("describes the filter used to build the report", async () => {
    const data = await service.build(workspace, { workspaceId: workspace.id, billable: true });
    expect(data.filterLabel).toBe("All time · billable only");
  });
});
