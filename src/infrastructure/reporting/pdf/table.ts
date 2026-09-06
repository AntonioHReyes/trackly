import { COLORS, FONTS } from "./theme.js";

export interface TableColumn {
  header: string;
  /** Share of the table width, relative to the sum of every column's weight. */
  weight: number;
  align?: "left" | "right";
}

export interface TableCell {
  text: string;
  /** Draws a proportional bar behind the cell (0–1), used for the share column. */
  bar?: { fraction: number; color: string };
}

export interface TableRow {
  cells: TableCell[];
  /** Rendered bold and separated by a rule — for the totals line. */
  emphasized?: boolean;
}

const HEADER_HEIGHT = 20;
const ROW_HEIGHT = 19;
const CELL_PADDING = 8;

/**
 * A zebra-striped table with a tinted header. Rows are drawn one by one so
 * the caller can page-break between them; returns the `y` below the table.
 */
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
  x: number,
  y: number,
  width: number,
): number {
  const widths = columnWidths(columns, width);

  doc.rect(x, y, width, HEADER_HEIGHT).fill(COLORS.surface);
  doc.font(FONTS.bold).fontSize(7.5).fillColor(COLORS.muted);
  columns.forEach((column, index) => {
    doc.text(column.header.toUpperCase(), cellX(x, widths, index), y + 6.5, {
      width: (widths[index] ?? 0) - CELL_PADDING * 2,
      align: column.align ?? "left",
      characterSpacing: 0.6,
      lineBreak: false,
    });
  });

  let rowY = y + HEADER_HEIGHT;
  rows.forEach((row, rowIndex) => {
    if (row.emphasized) {
      doc
        .moveTo(x, rowY)
        .lineTo(x + width, rowY)
        .lineWidth(0.8)
        .stroke(COLORS.line);
    } else if (rowIndex % 2 === 1) {
      doc.rect(x, rowY, width, ROW_HEIGHT).fill(COLORS.zebra);
    }

    row.cells.forEach((cell, index) => {
      const columnX = cellX(x, widths, index);
      const columnWidth = (widths[index] ?? 0) - CELL_PADDING * 2;
      if (cell.bar) {
        drawShareBar(doc, cell.bar, columnX, rowY + ROW_HEIGHT / 2, columnWidth);
      }
      doc
        .font(row.emphasized ? FONTS.bold : FONTS.regular)
        .fontSize(8.5)
        .fillColor(row.emphasized ? COLORS.ink : COLORS.body)
        .text(cell.text, columnX, rowY + 5.5, {
          width: columnWidth,
          align: columns[index]?.align ?? "left",
          lineBreak: false,
        });
    });
    rowY += ROW_HEIGHT;
  });

  return rowY;
}

export function tableHeight(rowCount: number): number {
  return HEADER_HEIGHT + rowCount * ROW_HEIGHT;
}

/**
 * Draws a table that may not fit on one page, repeating the header on every
 * continuation page. Returns the `y` below the last drawn row.
 */
export function drawPaginatedTable(
  doc: PDFKit.PDFDocument,
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
  x: number,
  y: number,
  width: number,
  bottomLimit: number,
): number {
  const minimumChunk = HEADER_HEIGHT + ROW_HEIGHT * 3;
  let cursor = y;
  let index = 0;

  while (index < rows.length) {
    if (bottomLimit - cursor < minimumChunk) {
      doc.addPage();
      cursor = doc.page.margins.top;
    }
    const fit = Math.max(1, Math.floor((bottomLimit - cursor - HEADER_HEIGHT) / ROW_HEIGHT));
    const chunk = rows.slice(index, index + fit);
    cursor = drawTable(doc, columns, chunk, x, cursor, width);
    index += chunk.length;
  }
  return cursor;
}

/** A slim track + fill drawn under the share percentage. */
function drawShareBar(
  doc: PDFKit.PDFDocument,
  bar: { fraction: number; color: string },
  x: number,
  centerY: number,
  width: number,
): void {
  const trackWidth = Math.max(0, width - 34);
  const height = 4;
  const barY = centerY - height / 2;
  doc.roundedRect(x, barY, trackWidth, height, height / 2).fill(COLORS.line);
  const filled = Math.max(1, trackWidth * Math.min(1, Math.max(0, bar.fraction)));
  doc.roundedRect(x, barY, filled, height, height / 2).fill(bar.color);
}

function columnWidths(columns: readonly TableColumn[], width: number): number[] {
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  return columns.map((column) => (column.weight / totalWeight) * width);
}

function cellX(x: number, widths: readonly number[], index: number): number {
  const offset = widths.slice(0, index).reduce((sum, w) => sum + w, 0);
  return x + offset + CELL_PADDING;
}
