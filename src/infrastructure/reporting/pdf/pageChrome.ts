import { COLORS, FONTS, SIZES } from "./theme.js";

export interface HeaderContent {
  workspaceName: string;
  filterLabel: string;
  generatedAt: Date;
}

/**
 * The full-bleed gradient band at the top of page 1. Returns the `y` where
 * page content can start.
 */
export function drawHeaderBand(doc: PDFKit.PDFDocument, content: HeaderContent): number {
  const width = doc.page.width;
  const height = SIZES.headerHeight;
  const gradient = doc.linearGradient(0, 0, width, height);
  gradient.stop(0, COLORS.brandDark).stop(1, COLORS.brand);
  doc.rect(0, 0, width, height).fill(gradient);

  const left = SIZES.pageMargin;
  doc
    .font(FONTS.bold)
    .fontSize(8)
    .fillColor(COLORS.white)
    .opacity(0.7)
    .text("TRACKLY · TIME REPORT", left, 28, { characterSpacing: 1.6 });
  doc
    .opacity(1)
    .font(FONTS.bold)
    .fontSize(21)
    .fillColor(COLORS.white)
    .text(content.workspaceName, left, 44);
  doc
    .font(FONTS.regular)
    .fontSize(9)
    .opacity(0.82)
    .text(content.filterLabel, left, 74, { width: width - left * 2 - 120 });

  doc
    .fontSize(8)
    .opacity(0.7)
    .text(
      `Generated ${formatGeneratedAt(content.generatedAt)}`,
      width - SIZES.pageMargin - 160,
      30,
      {
        width: 160,
        align: "right",
      },
    );
  doc.opacity(1);

  return height + 26;
}

export interface InvoiceHeaderContent {
  workspaceName: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
}

/**
 * The header band for `tck invoice pdf`: title/number on the left, issue and
 * due dates on the right. Deliberately separate from `drawHeaderBand` — an
 * invoice's header carries different, fixed fields, not a filter summary.
 */
export function drawInvoiceHeaderBand(doc: PDFKit.PDFDocument, content: InvoiceHeaderContent): number {
  const width = doc.page.width;
  const height = SIZES.headerHeight;
  const gradient = doc.linearGradient(0, 0, width, height);
  gradient.stop(0, COLORS.brandDark).stop(1, COLORS.brand);
  doc.rect(0, 0, width, height).fill(gradient);

  const left = SIZES.pageMargin;
  doc
    .font(FONTS.bold)
    .fontSize(8)
    .fillColor(COLORS.white)
    .opacity(0.7)
    .text("TRACKLY · INVOICE", left, 28, { characterSpacing: 1.6 });
  doc
    .opacity(1)
    .font(FONTS.bold)
    .fontSize(21)
    .fillColor(COLORS.white)
    .text(`Invoice ${content.invoiceNumber}`, left, 44);
  doc
    .font(FONTS.regular)
    .fontSize(9)
    .opacity(0.82)
    .text(content.workspaceName, left, 74);

  const rightWidth = 200;
  const rightX = width - SIZES.pageMargin - rightWidth;
  doc
    .fontSize(8)
    .opacity(0.7)
    .text(`Issued ${formatInvoiceDate(content.issueDate)}`, rightX, 44, {
      width: rightWidth,
      align: "right",
    });
  if (content.dueDate) {
    doc.text(`Due ${formatInvoiceDate(content.dueDate)}`, rightX, 58, {
      width: rightWidth,
      align: "right",
    });
  }
  doc.opacity(1);

  return height + 26;
}

function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Footers are drawn last, over buffered pages, because the page count isn't
 * known until the content has been laid out.
 */
export function drawFooters(doc: PDFKit.PDFDocument, workspaceName: string): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    // Writing inside the bottom margin would otherwise make pdfkit spill the
    // footer onto a brand-new page.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 32;
    const width = doc.page.width - SIZES.pageMargin * 2;
    doc
      .moveTo(SIZES.pageMargin, y - 10)
      .lineTo(SIZES.pageMargin + width, y - 10)
      .lineWidth(0.5)
      .stroke(COLORS.line);
    doc.font(FONTS.regular).fontSize(7.5).fillColor(COLORS.faint);
    doc.text(`Trackly · ${workspaceName}`, SIZES.pageMargin, y, { width, align: "left" });
    doc.text(`Page ${i + 1} of ${range.count}`, SIZES.pageMargin, y, { width, align: "right" });
  }
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
