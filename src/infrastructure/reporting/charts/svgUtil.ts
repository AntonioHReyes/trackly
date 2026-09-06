import { COLORS, FONTS } from "../pdf/theme.js";

/** Escapes text for safe embedding inside an SVG `<text>` node. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export interface SvgTextOptions {
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
}

/**
 * A `<text>` node with the attributes `svg-to-pdfkit` understands. Fonts are
 * named explicitly because the PDF has no CSS cascade to inherit from.
 */
export function svgText(text: string, x: number, y: number, options: SvgTextOptions): string {
  const font = options.bold ? FONTS.bold : FONTS.regular;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${options.size}" fill="${options.fill}" text-anchor="${options.anchor ?? "start"}">${escapeXml(text)}</text>`;
}

/** Placeholder drawn instead of an empty chart, so the section never looks broken. */
export function emptyChart(width: number, height: number, message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${svgText(message, width / 2, height / 2, { size: 9, fill: COLORS.faint, anchor: "middle" })}
  </svg>`;
}

export interface Scale {
  /** Axis maximum, rounded up to a readable step. */
  max: number;
  ticks: number[];
}

/**
 * Rounds an axis maximum up to a human-friendly step (1, 2, 2.5 or 5 × 10ⁿ)
 * so gridline labels read as `2 / 4 / 6` instead of `2.37 / 4.74`.
 */
export function niceScale(maxValue: number, tickCount = 4): Scale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { max: 1, ticks: [0, 1] };
  }
  const rawStep = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep =
    (normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10) * magnitude;
  const max = Math.ceil(maxValue / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + niceStep / 2; tick += niceStep) {
    ticks.push(Math.round(tick * 1000) / 1000);
  }
  return { max, ticks };
}
