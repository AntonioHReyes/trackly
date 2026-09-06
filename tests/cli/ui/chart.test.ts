import { beforeEach, describe, expect, it } from "vitest";
import { setColorEnabled, stripAnsi } from "../../../src/cli/ui/ansi.js";
import { renderDailyHoursChart, renderProjectHoursChart } from "../../../src/cli/ui/chart.js";
import { Money } from "../../../src/domain/value-objects/Money.js";
import type { DayHours, ProjectHours } from "../../../src/application/services/ReportService.js";

function projectHours(name: string, hours: number): ProjectHours {
  return {
    projectId: name,
    projectName: name,
    hours,
    billableHours: hours,
    amount: Money.zero("USD"),
    rate: null,
  };
}

describe("renderDailyHoursChart", () => {
  beforeEach(() => setColorEnabled(false));

  it("shows an empty-state message when there are no days", () => {
    expect(renderDailyHoursChart([])).toBe("No entries in this range.");
  });

  it("renders one row per day with a proportional bar and the hour value", () => {
    const days: DayHours[] = [
      { date: "2026-01-05", hours: 4 },
      { date: "2026-01-06", hours: 2 },
      { date: "2026-01-07", hours: 0 },
    ];
    const out = stripAnsi(renderDailyHoursChart(days)).split("\n");
    expect(out).toHaveLength(3);
    expect(out[0]).toContain("4.00h");
    expect(out[1]).toContain("2.00h");
    expect(out[2]).toContain("—");
    // Twice the hours means (roughly) twice the filled bar width.
    const filledWidth = (line: string): number => (/█+/.exec(line)?.[0].length ?? 0);
    expect(filledWidth(out[0] as string)).toBeGreaterThan(filledWidth(out[1] as string));
  });

  it("refuses to render a chart for very long ranges instead of a wall of rows", () => {
    const days: DayHours[] = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      hours: 1,
    }));
    expect(renderDailyHoursChart(days)).toMatch(/too long/i);
  });
});

describe("renderProjectHoursChart", () => {
  beforeEach(() => setColorEnabled(false));

  it("shows an empty-state message when there are no projects", () => {
    expect(renderProjectHoursChart([])).toBe("No entries in this range.");
  });

  it("renders one row per project with its share of the total", () => {
    const projects = [projectHours("Website", 6), projectHours("Mobile App", 2)];
    const out = renderProjectHoursChart(projects).split("\n");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("Website");
    expect(out[0]).toContain("6.00h");
    expect(out[0]).toContain("75%");
    expect(out[1]).toContain("Mobile App");
    expect(out[1]).toContain("25%");
  });
});
