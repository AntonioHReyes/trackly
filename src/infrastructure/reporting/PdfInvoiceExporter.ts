import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import type { InvoiceExporter } from "../../application/ports/InvoiceExporter.js";
import type { InvoiceData } from "../../application/services/InvoiceService.js";
import { drawInvoiceHeaderBand, drawFooters } from "./pdf/pageChrome.js";
import { drawPaginatedTable, type TableColumn, type TableRow } from "./pdf/table.js";
import { drawSectionHeading, formatDuration, truncate } from "./pdf/primitives.js";
import { COLORS, FONTS, SIZES } from "./pdf/theme.js";

/**
 * Renders `InvoiceData` as a PDF: header (number, issue/due dates),
 * bill-to block, a line-item table priced by project, totals with tax, and
 * an optional notes section (`tck invoice pdf`, see SPEC.md's Invoices
 * command). Shares drawing primitives with `PdfReportExporter` so both
 * documents look like they came from the same tool.
 */
export class PdfInvoiceExporter implements InvoiceExporter {
  async export(data: InvoiceData, outPath: string): Promise<void> {
    const doc = new PDFDocument({ size: "A4", margin: SIZES.pageMargin, bufferPages: true });
    const stream = createWriteStream(outPath);
    doc.pipe(stream);

    const left = SIZES.pageMargin;
    const width = doc.page.width - SIZES.pageMargin * 2;

    let y = drawInvoiceHeaderBand(doc, {
      workspaceName: data.workspace.name,
      invoiceNumber: data.details.number,
      issueDate: data.details.issueDate,
      dueDate: data.details.dueDate,
    });
    y = this.drawBillTo(doc, data, y, left, width);
    y = this.drawLineItems(doc, data, y, left, width);
    y = this.drawTotals(doc, data, y, left, width);
    this.drawNotes(doc, data, y, left, width);

    drawFooters(doc, data.workspace.name);
    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => {
        resolve();
      });
      stream.on("error", reject);
    });
  }

  private drawBillTo(
    doc: PDFKit.PDFDocument,
    data: InvoiceData,
    y: number,
    x: number,
    width: number,
  ): number {
    if (!data.details.billTo) return y;
    const contentY = drawSectionHeading(doc, "Bill to", x, y);
    doc
      .font(FONTS.regular)
      .fontSize(9.5)
      .fillColor(COLORS.body)
      .text(data.details.billTo, x, contentY, { width, lineGap: 2 });
    return doc.y + SIZES.sectionGap;
  }

  private drawLineItems(
    doc: PDFKit.PDFDocument,
    data: InvoiceData,
    y: number,
    x: number,
    width: number,
  ): number {
    const columns: TableColumn[] = [
      { header: "Project", weight: 2.6 },
      { header: "Hours", weight: 1, align: "right" },
      { header: "Rate", weight: 1, align: "right" },
      { header: "Amount", weight: 1.2, align: "right" },
    ];
    const rows: TableRow[] = data.lineItems.map((item) => ({
      cells: [
        { text: truncate(item.projectName, 40) },
        { text: formatDuration(item.hours) },
        { text: item.rate.toDecimal().toFixed(2) },
        { text: item.amount.toDecimal().toFixed(2) },
      ],
    }));
    if (rows.length === 0) {
      rows.push({
        cells: [
          { text: "No billable hours with a resolvable rate" },
          { text: "" },
          { text: "" },
          { text: "" },
        ],
      });
    }

    const contentY = drawSectionHeading(doc, "Line items", x, y);
    const bottom = drawPaginatedTable(
      doc,
      columns,
      rows,
      x,
      contentY,
      width,
      doc.page.height - SIZES.pageMargin - 18,
    );
    return bottom + SIZES.sectionGap;
  }

  private drawTotals(
    doc: PDFKit.PDFDocument,
    data: InvoiceData,
    y: number,
    x: number,
    width: number,
  ): number {
    const boxWidth = 220;
    const boxX = x + width - boxWidth;
    const lines: Array<[string, string, boolean?]> = [
      ["Subtotal", data.subtotal.toDecimal().toFixed(2)],
      [`Tax (${data.details.taxRate}%)`, data.taxAmount.toDecimal().toFixed(2)],
      [`Total (${data.total.currency})`, data.total.toDecimal().toFixed(2), true],
    ];

    let rowY = y;
    for (const [label, value, emphasized] of lines) {
      if (emphasized) {
        doc
          .moveTo(boxX, rowY)
          .lineTo(boxX + boxWidth, rowY)
          .lineWidth(0.8)
          .stroke(COLORS.line);
        rowY += 6;
      }
      doc
        .font(emphasized ? FONTS.bold : FONTS.regular)
        .fontSize(emphasized ? 11 : 9.5)
        .fillColor(emphasized ? COLORS.ink : COLORS.body)
        .text(label, boxX, rowY, { width: boxWidth * 0.55 });
      doc.text(value, boxX + boxWidth * 0.55, rowY, {
        width: boxWidth * 0.45,
        align: "right",
      });
      rowY += emphasized ? 20 : 16;
    }

    if (data.unbilledHours > 0) {
      doc
        .font(FONTS.regular)
        .fontSize(8)
        .fillColor(COLORS.faint)
        .text(
          `${formatDuration(data.unbilledHours)} of billable time had no resolvable rate and was excluded.`,
          x,
          rowY + 4,
          { width },
        );
      rowY = doc.y;
    }

    return rowY + SIZES.sectionGap;
  }

  private drawNotes(
    doc: PDFKit.PDFDocument,
    data: InvoiceData,
    y: number,
    x: number,
    width: number,
  ): void {
    if (!data.details.notes) return;
    const contentY = drawSectionHeading(doc, "Notes", x, y);
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.body)
      .text(data.details.notes, x, contentY, { width, lineGap: 2 });
  }
}
