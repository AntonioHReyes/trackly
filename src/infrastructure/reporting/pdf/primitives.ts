import { COLORS, FONTS, SIZES } from "./theme.js";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rounded surface with a hairline border — the base of every panel/card. */
export function drawCard(doc: PDFKit.PDFDocument, box: Box, fill: string = COLORS.white): void {
  doc
    .roundedRect(box.x, box.y, box.width, box.height, SIZES.cardRadius)
    .fillAndStroke(fill, COLORS.line);
  doc.lineWidth(1);
}

/**
 * A small-caps section title with a short accent rule underneath. Returns the
 * `y` where the section's content can start.
 */
export function drawSectionHeading(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number,
): number {
  doc
    .font(FONTS.bold)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(title.toUpperCase(), x, y, { characterSpacing: 1.1 });
  const ruleY = y + 14;
  doc
    .moveTo(x, ruleY)
    .lineTo(x + 22, ruleY)
    .lineWidth(2)
    .stroke(COLORS.brand);
  doc.lineWidth(1);
  return ruleY + 10;
}

/** Truncates with an ellipsis so long project names can't overflow a column. */
export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** `7.5` → `7h 30m`, the way a timesheet reads. */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  return `${Math.floor(totalMinutes / 60)}h ${`${totalMinutes % 60}`.padStart(2, "0")}m`;
}
