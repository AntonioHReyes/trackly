import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EarningsService } from "../../../src/application/services/EarningsService.js";
import { ReportService } from "../../../src/application/services/ReportService.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";
import { Project } from "../../../src/domain/entities/Project.js";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { DateRange } from "../../../src/domain/value-objects/DateRange.js";
import { Rounding } from "../../../src/domain/value-objects/Rounding.js";
import { InMemoryTimeEntryRepository } from "../../support/fakes/InMemoryTimeEntryRepository.js";
import { InMemoryProjectRepository } from "../../support/fakes/InMemoryProjectRepository.js";
import { InMemoryTagRepository } from "../../support/fakes/InMemoryTagRepository.js";

// Frozen "now" so the calendar shortcuts the summary uses are deterministic.
const NOW = new Date(2026, 8, 15, 12, 0); // 2026-09-15 (Tue)

describe("EarningsService", () => {
  let entries: InMemoryTimeEntryRepository;
  let projects: InMemoryProjectRepository;
  let service: EarningsService;
  let workspace: Workspace;
  let project: Project;

  /** An entry priced at $100/h by the project rate, `hours` long, starting at `start`. */
  async function track(start: Date, hours: number, billable = true): Promise<TimeEntry> {
    const entry = TimeEntry.addManual({
      workspaceId: workspace.id,
      description: "Work",
      startTs: start,
      endTs: new Date(start.getTime() + hours * 3_600_000),
      projectId: project.id,
      billable,
    });
    await entries.save(entry);
    return entry;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    entries = new InMemoryTimeEntryRepository();
    projects = new InMemoryProjectRepository();
    service = new EarningsService(new ReportService(entries, projects, new InMemoryTagRepository()));

    workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    project = Project.create({ workspaceId: workspace.id, name: "Website", hourlyRate: 100 });
    await projects.save(project);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("summarize", () => {
    it("totals each period, nesting shorter ones inside longer ones", async () => {
      await track(new Date(2026, 8, 15, 9), 2); // today  -> $200
      await track(new Date(2026, 8, 14, 9), 1); // Mon, same week -> $100
      await track(new Date(2026, 8, 2, 9), 3); // earlier this month -> $300
      await track(new Date(2026, 2, 2, 9), 4); // earlier this year -> $400

      const summary = await service.summarize(workspace, { workspaceId: workspace.id }, "monday");
      const byLabel = new Map(summary.periods.map((p) => [p.label, p.amount.toDecimal()]));

      expect(byLabel.get("Today")).toBeCloseTo(200);
      expect(byLabel.get("This week")).toBeCloseTo(300);
      expect(byLabel.get("This month")).toBeCloseTo(600);
      expect(byLabel.get("This year")).toBeCloseTo(1000);
    });

    it("reports a monthly trend of six months, zero-filling the quiet ones", async () => {
      await track(new Date(2026, 8, 3, 9), 1); // September -> $100
      await track(new Date(2026, 6, 3, 9), 2); // July -> $200

      const summary = await service.summarize(workspace, { workspaceId: workspace.id }, "monday");

      expect(summary.monthlyTrend.map((b) => b.key)).toEqual([
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
      ]);
      const byKey = new Map(summary.monthlyTrend.map((b) => [b.key, b.amount.toDecimal()]));
      expect(byKey.get("2026-07")).toBeCloseTo(200);
      expect(byKey.get("2026-08")).toBeCloseTo(0);
      expect(byKey.get("2026-09")).toBeCloseTo(100);
    });

    it("counts only billable time as income, but all time as hours", async () => {
      await track(new Date(2026, 8, 15, 9), 2, true);
      await track(new Date(2026, 8, 15, 14), 3, false);

      const summary = await service.summarize(workspace, { workspaceId: workspace.id }, "monday");
      const today = summary.periods.find((p) => p.label === "Today");

      expect(today?.amount.toDecimal()).toBeCloseTo(200);
      expect(today?.billableHours).toBeCloseTo(2);
      expect(today?.hours).toBeCloseTo(5);
    });

    it("honors a project filter so a client's income can be isolated", async () => {
      const other = Project.create({ workspaceId: workspace.id, name: "Other", hourlyRate: 100 });
      await projects.save(other);
      await track(new Date(2026, 8, 15, 9), 2); // counted
      await entries.save(
        TimeEntry.addManual({
          workspaceId: workspace.id,
          description: "Other work",
          startTs: new Date(2026, 8, 15, 14),
          endTs: new Date(2026, 8, 15, 16),
          projectId: other.id,
        }),
      );

      const summary = await service.summarize(
        workspace,
        { workspaceId: workspace.id, projectIds: [project.id] },
        "monday",
      );
      expect(summary.periods.find((p) => p.label === "Today")?.amount.toDecimal()).toBeCloseTo(200);
    });
  });

  describe("detail", () => {
    it("compares the range against the previous period", async () => {
      await track(new Date(2026, 8, 15, 9), 3); // current: $300
      await track(new Date(2026, 8, 8, 9), 2); // previous week: $200

      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 8, 14), new Date(2026, 8, 21)),
        },
        "This week",
        DateRange.of(new Date(2026, 8, 7), new Date(2026, 8, 14)),
      );

      expect(detail.current.amount.toDecimal()).toBeCloseTo(300);
      expect(detail.previous?.amount.toDecimal()).toBeCloseTo(200);
    });

    it("leaves the comparison out when no previous range is given", async () => {
      await track(new Date(2026, 8, 15, 9), 1);
      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 8, 14), new Date(2026, 8, 21)),
        },
        "This week",
        null,
      );
      expect(detail.previous).toBeNull();
    });

    it("charts earnings per day, zero-filling days without income", async () => {
      await track(new Date(2026, 8, 14, 9), 1); // $100 on the 14th

      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 8, 14), new Date(2026, 8, 17)),
        },
        "Range",
        null,
      );

      expect(detail.granularity).toBe("day");
      expect(detail.trend.map((b) => [b.key, b.amount.toDecimal()])).toEqual([
        ["2026-09-14", 100],
        ["2026-09-15", 0],
        ["2026-09-16", 0],
      ]);
    });

    it("switches to monthly bars for ranges too long to plot daily", async () => {
      await track(new Date(2026, 6, 8, 9), 2); // July -> $200
      await track(new Date(2026, 8, 3, 9), 1); // September -> $100

      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 5, 1), new Date(2026, 9, 1)), // Jun–Sep
        },
        "Range",
        null,
      );

      expect(detail.granularity).toBe("month");
      expect(detail.trend.map((b) => [b.key, b.amount.toDecimal()])).toEqual([
        ["2026-06", 0],
        ["2026-07", 200],
        ["2026-08", 0],
        ["2026-09", 100],
      ]);
    });

    it("applies rounding to the amounts it reports", async () => {
      // 20 minutes rounded up to the next 30 becomes half an hour -> $50.
      await entries.save(
        TimeEntry.addManual({
          workspaceId: workspace.id,
          description: "Short",
          startTs: new Date(2026, 8, 15, 9),
          endTs: new Date(2026, 8, 15, 9, 20),
          projectId: project.id,
        }),
      );

      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 8, 15), new Date(2026, 8, 16)),
        },
        "Today",
        null,
        { rounding: Rounding.of("up", 30) },
      );

      expect(detail.current.amount.toDecimal()).toBeCloseTo(50);
    });

    it("surfaces billable hours that have no rate instead of silently dropping them", async () => {
      const rateless = Project.create({ workspaceId: workspace.id, name: "Unpriced" });
      await projects.save(rateless);
      await entries.save(
        TimeEntry.addManual({
          workspaceId: workspace.id,
          description: "Unpriced work",
          startTs: new Date(2026, 8, 15, 9),
          endTs: new Date(2026, 8, 15, 11),
          projectId: rateless.id,
        }),
      );

      const detail = await service.detail(
        workspace,
        {
          workspaceId: workspace.id,
          range: DateRange.of(new Date(2026, 8, 15), new Date(2026, 8, 16)),
        },
        "Today",
        null,
      );

      expect(detail.current.amount.toDecimal()).toBeCloseTo(0);
      expect(detail.current.unbilledHours).toBeCloseTo(2);
    });
  });
});
