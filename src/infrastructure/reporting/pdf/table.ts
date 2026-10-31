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
const MIN_ROW_HEIGHT = 19;
const CELL_PADDING = 8;
const ROW_PADDING_Y = 5.5;
const FONT_SIZE = 8.5;
const LINE_GAP = 1.5;

/**
 * A zebra-striped table with a tinted header. Cell text wraps onto as many
 * lines as it needs, so each row grows to fit its tallest cell. Returns the
 * `y` below the table.
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
      width: textWidth(widths, index),
      align: column.align ?? "left",
      characterSpacing: 0.6,
      lineBreak: false,
    });
  });

  let rowY = y + HEADER_HEIGHT;
  rows.forEach((row, rowIndex) => {
    const height = rowHeight(doc, row, widths);
    if (row.emphasized) {
      doc
        .moveTo(x, rowY)
        .lineTo(x + width, rowY)
        .lineWidth(0.8)
        .stroke(COLORS.line);
    } else if (rowIndex % 2 === 1) {
      doc.rect(x, rowY, width, height).fill(COLORS.zebra);
    }

    row.cells.forEach((cell, index) => {
      const columnX = cellX(x, widths, index);
      const columnWidth = textWidth(widths, index);
      if (cell.bar) {
        drawShareBar(doc, cell.bar, columnX, rowY + MIN_ROW_HEIGHT / 2, columnWidth);
      }
      useRowFont(doc, row)
        .fillColor(row.emphasized ? COLORS.ink : COLORS.body)
        .text(cell.text, columnX, rowY + ROW_PADDING_Y, {
          width: columnWidth,
          align: columns[index]?.align ?? "left",
          lineGap: LINE_GAP,
        });
    });
    rowY += height;
  });

  return rowY;
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
  const widths = columnWidths(columns, width);
  const heights = rows.map((row) => rowHeight(doc, row, widths));
  let cursor = y;
  let index = 0;

  while (index < rows.length) {
    const firstRowHeight = heights[index] ?? MIN_ROW_HEIGHT;
    const isFreshPage = cursor === doc.page.margins.top;
    if (!isFreshPage && bottomLimit - cursor < HEADER_HEIGHT + firstRowHeight) {
      doc.addPage();
      cursor = doc.page.margins.top;
    }
    let available = bottomLimit - cursor - HEADER_HEIGHT;
    let end = index;
    while (end < rows.length && (end === index || (heights[end] ?? 0) <= available)) {
      available -= heights[end] ?? 0;
      end += 1;
    }
    cursor = drawTable(doc, columns, rows.slice(index, end), x, cursor, width);
    index = end;
  }
  return cursor;
}

function rowHeight(doc: PDFKit.PDFDocument, row: TableRow, widths: readonly number[]): number {
  useRowFont(doc, row);
  const tallest = row.cells.reduce((max, cell, index) => {
    const height = doc.heightOfString(cell.text, {
      width: textWidth(widths, index),
      lineGap: LINE_GAP,
    });
    return Math.max(max, height);
  }, 0);
  return Math.max(MIN_ROW_HEIGHT, Math.ceil(tallest - LINE_GAP + ROW_PADDING_Y * 2));
}

function useRowFont(doc: PDFKit.PDFDocument, row: TableRow): PDFKit.PDFDocument {
  return doc.font(row.emphasized ? FONTS.bold : FONTS.regular).fontSize(FONT_SIZE);
}

function textWidth(widths: readonly number[], index: number): number {
  return (widths[index] ?? 0) - CELL_PADDING * 2;
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
