import { emptyChart, svgText } from "./svgUtil.js";
import { COLORS, paletteColor } from "../pdf/theme.js";
import { truncate } from "../pdf/primitives.js";

export interface DonutChartDatum {
  label: string;
  value: number;
}

export interface DonutChartOptions {
  width: number;
  height: number;
  /** Big number in the hole; the caller formats it (e.g. `49h 30m`). */
  centerValue: string;
  centerLabel: string;
}

const OUTER_RADIUS = 68;
const INNER_RADIUS = 44;
const LEGEND_X = 200;
const LEGEND_ROW_HEIGHT = 17;
const MAX_LEGEND_ROWS = 8;

/**
 * Hand-rolled SVG donut with a right-hand legend (distribution by project).
 * A donut rather than a pie so the hole can carry the range total — see
 * barChart.ts for why the charts are hand-rolled.
 */
export function renderDonutChart(
  data: readonly DonutChartDatum[],
  options: DonutChartOptions,
): string {
  const { width, height } = options;
  const slices = collapseTail(data.filter((d) => d.value > 0));
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) {
    return emptyChart(width, height, "No entries in this range");
  }

  const cx = OUTER_RADIUS + 18;
  const cy = height / 2;

  const paths: string[] = [];
  const legend: string[] = [];
  let angle = -Math.PI / 2;

  slices.forEach((slice, index) => {
    const fraction = slice.value / total;
    const color = paletteColor(index);
    paths.push(
      slices.length === 1
        ? fullRing(cx, cy, color)
        : arcSlice(cx, cy, angle, angle + fraction * 2 * Math.PI, color),
    );
    angle += fraction * 2 * Math.PI;

    const rowY = cy - (slices.length * LEGEND_ROW_HEIGHT) / 2 + index * LEGEND_ROW_HEIGHT + 12;
    legend.push(`
      <rect x="${LEGEND_X}" y="${rowY - 7}" width="8" height="8" rx="2" fill="${color}" />
      ${svgText(truncate(slice.label, 34), LEGEND_X + 14, rowY, { size: 8, fill: COLORS.body })}
      ${svgText(`${slice.value.toFixed(2)}h`, width - 52, rowY, { size: 8, fill: COLORS.muted, anchor: "end" })}
      ${svgText(`${(fraction * 100).toFixed(0)}%`, width - 6, rowY, { size: 8, fill: COLORS.ink, anchor: "end", bold: true })}
    `);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${paths.join("\n")}
    ${svgText(options.centerValue, cx, cy + 2, { size: 13, fill: COLORS.ink, anchor: "middle", bold: true })}
    ${svgText(options.centerLabel.toUpperCase(), cx, cy + 15, { size: 6.5, fill: COLORS.faint, anchor: "middle" })}
    ${legend.join("\n")}
  </svg>`;
}

/** Keeps the legend readable by folding everything past the top N into "Others". */
function collapseTail(data: readonly DonutChartDatum[]): DonutChartDatum[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_LEGEND_ROWS) return sorted;
  const head = sorted.slice(0, MAX_LEGEND_ROWS - 1);
  const tail = sorted.slice(MAX_LEGEND_ROWS - 1);
  return [
    ...head,
    { label: `Others (${tail.length})`, value: tail.reduce((sum, d) => sum + d.value, 0) },
  ];
}

/** A single-project donut can't be an arc (start === end), so draw two circles. */
function fullRing(cx: number, cy: number, color: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${OUTER_RADIUS}" fill="${color}" />
    <circle cx="${cx}" cy="${cy}" r="${INNER_RADIUS}" fill="${COLORS.white}" />`;
}

function arcSlice(cx: number, cy: number, from: number, to: number, color: string): string {
  const largeArc = to - from > Math.PI ? 1 : 0;
  const outerStart = pointOn(cx, cy, OUTER_RADIUS, from);
  const outerEnd = pointOn(cx, cy, OUTER_RADIUS, to);
  const innerEnd = pointOn(cx, cy, INNER_RADIUS, to);
  const innerStart = pointOn(cx, cy, INNER_RADIUS, from);
  const d = [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
  // The white stroke is what separates adjacent slices visually.
  return `<path d="${d}" fill="${color}" stroke="${COLORS.white}" stroke-width="1.5" />`;
}

function pointOn(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: Math.round((cx + radius * Math.cos(angle)) * 100) / 100,
    y: Math.round((cy + radius * Math.sin(angle)) * 100) / 100,
  };
}
