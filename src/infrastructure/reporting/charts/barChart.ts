import { emptyChart, niceScale, svgText } from "./svgUtil.js";
import { COLORS } from "../pdf/theme.js";

export interface BarChartDatum {
  label: string;
  value: number;
  /** Drawn in a lighter shade — used for weekends. */
  muted?: boolean;
  /** Kept when labels are thinned out — used for month boundaries. */
  alwaysLabel?: boolean;
}

export interface BarChartOptions {
  width: number;
  height: number;
  /** Suffix appended to the axis labels, e.g. `h`. */
  unit?: string;
}

const PADDING = { top: 16, right: 12, bottom: 28, left: 34 };
const BAR_RADIUS = 2.5;
const MAX_BARS_WITH_VALUE_LABELS = 16;
/** Horizontal room a `Sep 12`-sized label needs before neighbours collide. */
const MIN_LABEL_SLOT = 15;

/**
 * Hand-rolled SVG bar chart (hours/day) with a labelled value axis and
 * horizontal gridlines. Deliberately not a charting library — see SPEC.md's
 * stack notes: pure-JS SVG keeps the CLI free of native `canvas` deps.
 */
export function renderBarChart(
  data: readonly BarChartDatum[],
  options: BarChartOptions = { width: 507, height: 196 },
): string {
  const { width, height, unit = "" } = options;
  const plot = {
    x: PADDING.left,
    y: PADDING.top,
    width: width - PADDING.left - PADDING.right,
    height: height - PADDING.top - PADDING.bottom,
  };
  const baseline = plot.y + plot.height;

  if (data.length === 0) {
    return emptyChart(width, height, "No entries in this range");
  }

  const scale = niceScale(Math.max(...data.map((d) => d.value)));
  const gridlines = scale.ticks
    .map((tick) => {
      const y = baseline - (tick / scale.max) * plot.height;
      return `<line x1="${plot.x}" y1="${round(y)}" x2="${plot.x + plot.width}" y2="${round(y)}" stroke="${COLORS.grid}" stroke-width="1" />
        ${svgText(`${formatTick(tick)}${unit}`, plot.x - 6, round(y) + 3, { size: 7, fill: COLORS.faint, anchor: "end" })}`;
    })
    .join("\n");

  const slot = plot.width / data.length;
  const barWidth = Math.max(3, Math.min(28, slot * 0.62));
  const showValues = data.length <= MAX_BARS_WITH_VALUE_LABELS;
  // Long ranges get every Nth label so the axis never turns into a smudge.
  const labelStep = Math.max(1, Math.ceil(MIN_LABEL_SLOT / slot));

  const bars = data
    .map((datum, index) => {
      const center = plot.x + slot * (index + 0.5);
      const x = center - barWidth / 2;
      const barHeight = scale.max === 0 ? 0 : (datum.value / scale.max) * plot.height;
      const y = baseline - barHeight;
      const fill = datum.muted ? "#c7d2fe" : COLORS.brand;
      const bar =
        datum.value > 0
          ? `<path d="${roundedTopBar(x, y, barWidth, barHeight)}" fill="${fill}" />`
          : "";
      const valueLabel =
        showValues && datum.value > 0
          ? svgText(datum.value.toFixed(1), center, y - 5, {
              size: 7,
              fill: COLORS.muted,
              anchor: "middle",
            })
          : "";
      const axisLabel =
        datum.alwaysLabel || index % labelStep === 0
          ? svgText(datum.label, center, baseline + 12, {
              size: 6.8,
              fill: COLORS.faint,
              anchor: "middle",
            })
          : "";
      return `${bar}
        ${valueLabel}
        ${axisLabel}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${gridlines}
    ${bars}
    <line x1="${plot.x}" y1="${baseline}" x2="${plot.x + plot.width}" y2="${baseline}" stroke="${COLORS.line}" stroke-width="1" />
  </svg>`;
}

/** Path for a bar whose top corners are rounded and bottom corners square. */
function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(BAR_RADIUS, width / 2, height);
  return [
    `M ${round(x)} ${round(y + height)}`,
    `L ${round(x)} ${round(y + radius)}`,
    `Q ${round(x)} ${round(y)} ${round(x + radius)} ${round(y)}`,
    `L ${round(x + width - radius)} ${round(y)}`,
    `Q ${round(x + width)} ${round(y)} ${round(x + width)} ${round(y + radius)}`,
    `L ${round(x + width)} ${round(y + height)}`,
    "Z",
  ].join(" ");
}

function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
