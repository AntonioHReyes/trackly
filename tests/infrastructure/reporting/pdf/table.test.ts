import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import {
  drawPaginatedTable,
  drawTable,
  type TableColumn,
  type TableRow,
} from "../../../../src/infrastructure/reporting/pdf/table.js";

const columns: TableColumn[] = [
  { header: "Description", weight: 3 },
  { header: "Duration", weight: 1, align: "right" },
];

function row(text: string): TableRow {
  return { cells: [{ text }, { text: "1h 00m" }] };
}

const longText =
  "Refactor the invoice pipeline so long descriptions wrap onto several lines instead of being cut off at the column edge";

describe("drawTable", () => {
  it("grows a row to fit wrapped text instead of truncating it", () => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const shortBottom = drawTable(doc, columns, [row("Short")], 40, 100, 300);
    const longBottom = drawTable(doc, columns, [row(longText)], 40, 100, 300);

    expect(longBottom - 100).toBeGreaterThan((shortBottom - 100) * 1.5);
  });
});

describe("drawPaginatedTable", () => {
  it("breaks multi-line rows across pages without crossing the bottom limit", () => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const bottomLimit = doc.page.height - 60;
    const rows = Array.from({ length: 60 }, () => row(longText));

    const end = drawPaginatedTable(doc, columns, rows, 40, 100, 300, bottomLimit);

    expect(doc.bufferedPageRange().count).toBeGreaterThan(1);
    expect(end).toBeLessThanOrEqual(bottomLimit);
  });
});
