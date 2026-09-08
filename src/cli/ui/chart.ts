import type { DayHours, ProjectHours } from "../../application/services/ReportService.js";
import type { EarningsBucket } from "../../application/services/EarningsService.js";
import { bold, dim, hexColor, truncate, visibleWidth } from "./ansi.js";

/**
 * Mirrors `CHART_PALETTE` in the PDF theme (see
 * `src/infrastructure/reporting/pdf/theme.ts`) so a project's color reads
 * the same whether you're looking at the terminal or a rendered report.
 * Duplicated rather than imported to keep `cli/` free of an `infrastructure`
 * dependency for what is otherwise a plain constant.
 */
const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
] as const;

const FULL_BLOCK = "█";
const TRACK = "░";
const MAX_BAR_WIDTH = 32;
/** Beyond this many days, one row per day stops being scannable. */
const MAX_DAY_ROWS = 31;

function barWidthFor(): number {
  const columns = process.stdout.columns ?? 80;
  return Math.max(10, Math.min(MAX_BAR_WIDTH, columns - 40));
}

function bar(value: number, max: number, width: number, color: (text: string) => string): string {
  if (max <= 0) return TRACK.repeat(width);
  const filled = Math.round((value / max) * width);
  return color(FULL_BLOCK.repeat(filled)) + dim(TRACK.repeat(width - filled));
}

/**
 * Horizontal bar chart of hours per day, one row per calendar day. Days
 * without entries still get a row (an empty track), same gap-free rule the
 * PDF bar chart follows — see `ReportService.toDailySeries`.
 */
export function renderDailyHoursChart(days: readonly DayHours[]): string {
  if (days.length === 0) return dim("No entries in this range.");
  if (days.length > MAX_DAY_ROWS) {
    return dim(
      `Range too long for a daily chart (${days.length} days, max ${MAX_DAY_ROWS}) — try a narrower range.`,
    );
  }

  const width = barWidthFor();
  const max = Math.max(...days.map((d) => d.hours), 0);
  const color = hexColor(PALETTE[0] as string);
  const labelWidth = Math.max(...days.map((d) => d.date.length));

  return days
    .map((d) => {
      const label = formatDayLabel(d.date).padEnd(labelWidth + 5);
      const value = d.hours > 0 ? `${d.hours.toFixed(2)}h` : dim("—");
      return `  ${dim(label)}${bar(d.hours, max, width, color)}  ${value}`;
    })
    .join("\n");
}

/** `2026-01-05` -> `Mon 01-05` — short enough to keep the bar wide. */
function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} ${isoDate.slice(5)}`;
}

/**
 * Horizontal bar chart of hours by project, one color per project (cycled
 * from `PALETTE`, same assignment order as the PDF donut's legend), with
 * each bar's share of the total.
 */
export function renderProjectHoursChart(projects: readonly ProjectHours[]): string {
  if (projects.length === 0) return dim("No entries in this range.");

  const width = barWidthFor();
  const max = Math.max(...projects.map((p) => p.hours), 0);
  const total = projects.reduce((sum, p) => sum + p.hours, 0);
  const nameWidth = Math.min(
    24,
    Math.max(...projects.map((p) => visibleWidth(p.projectName))),
  );

  return projects
    .map((p, i) => {
      const color = hexColor(PALETTE[i % PALETTE.length] as string);
      const name = truncate(p.projectName, nameWidth).padEnd(nameWidth);
      const share = total > 0 ? `${((p.hours / total) * 100).toFixed(0)}%`.padStart(4) : "  0%";
      return `  ${color("■")} ${name}  ${bar(p.hours, max, width, color)}  ${p.hours.toFixed(2)}h ${dim(share)}`;
    })
    .join("\n");
}

/**
 * Horizontal bar chart of money earned per bucket (`tck earnings`). Bars are
 * scaled to the best period rather than to the total, so a flat month still
 * shows relief. Keys are either `YYYY-MM-DD` (daily) or `YYYY-MM` (monthly)
 * and are labelled accordingly.
 */
export function renderEarningsChart(buckets: readonly EarningsBucket[]): string {
  if (buckets.length === 0) return dim("No earnings in this range.");
  if (buckets.length > MAX_DAY_ROWS) {
    return dim(
      `Range too long to chart (${buckets.length} bars, max ${MAX_DAY_ROWS}) — try a narrower range.`,
    );
  }

  const width = barWidthFor();
  const amounts = buckets.map((b) => b.amount.toDecimal());
  const max = Math.max(...amounts, 0);
  const color = hexColor(PALETTE[2] as string); // green — this chart is money
  const labels = buckets.map((b) => formatBucketLabel(b.key));
  const labelWidth = Math.max(...labels.map((label) => label.length));
  const currency = buckets[0]?.amount.currency ?? "";
  const valueWidth = Math.max(...amounts.map((a) => a.toFixed(2).length));

  return buckets
    .map((bucket, i) => {
      const label = (labels[i] as string).padEnd(labelWidth + 2);
      const amount = amounts[i] as number;
      const value =
        amount > 0 ? `${amount.toFixed(2).padStart(valueWidth)} ${currency}` : dim("—");
      const hours = bucket.hours > 0 ? dim(` ${bucket.hours.toFixed(2)}h`) : "";
      return `  ${dim(label)}${bar(amount, max, width, color)}  ${value}${hours}`;
    })
    .join("\n");
}

/** `2026-09-07` -> `Mon 09-07`; `2026-09` -> `Sep 2026`. */
function formatBucketLabel(key: string): string {
  if (key.length === 7) {
    const date = new Date(`${key}-01T00:00:00`);
    return `${date.toLocaleDateString(undefined, { month: "short" })} ${key.slice(0, 4)}`;
  }
  return formatDayLabel(key);
}

export function chartHeading(title: string): string {
  return bold(title);
}
