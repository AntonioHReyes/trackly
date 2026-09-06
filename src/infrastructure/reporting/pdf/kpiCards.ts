import { drawCard } from "./primitives.js";
import { COLORS, FONTS, SIZES } from "./theme.js";

export interface Kpi {
  label: string;
  value: string;
  /** Optional second line (e.g. a share of the total). */
  hint?: string;
  accent: string;
}

const CARD_HEIGHT = 62;
const CARD_GAP = 10;

/** A row of evenly-sized summary cards. Returns the `y` below the row. */
export function drawKpiCards(
  doc: PDFKit.PDFDocument,
  kpis: readonly Kpi[],
  x: number,
  y: number,
  totalWidth: number,
): number {
  const width = (totalWidth - CARD_GAP * (kpis.length - 1)) / kpis.length;

  kpis.forEach((kpi, index) => {
    const cardX = x + index * (width + CARD_GAP);
    drawCard(doc, { x: cardX, y, width, height: CARD_HEIGHT }, COLORS.surface);
    // A short accent stripe keeps the cards from reading as empty boxes.
    doc.roundedRect(cardX + 1, y + 12, 3, CARD_HEIGHT - 24, 1.5).fill(kpi.accent);

    const textX = cardX + 14;
    const textWidth = width - 22;
    doc
      .font(FONTS.regular)
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(kpi.label.toUpperCase(), textX, y + 13, { width: textWidth, characterSpacing: 0.8 });
    doc
      .font(FONTS.bold)
      .fontSize(15)
      .fillColor(COLORS.ink)
      .text(kpi.value, textX, y + 27, { width: textWidth, lineBreak: false });
    if (kpi.hint) {
      doc
        .font(FONTS.regular)
        .fontSize(7.5)
        .fillColor(COLORS.faint)
        .text(kpi.hint, textX, y + 46, { width: textWidth, lineBreak: false });
    }
  });

  return y + CARD_HEIGHT + SIZES.sectionGap;
}
