import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import type { ReportExporter } from "../../application/ports/ReportExporter.js";
import type { ReportData } from "../../application/services/ReportService.js";
import type { TimeEntry } from "../../domain/entities/TimeEntry.js";
import { renderBarChart, type BarChartDatum } from "./charts/barChart.js";
import { renderDonutChart } from "./charts/donutChart.js";
import { drawHeaderBand, drawFooters } from "./pdf/pageChrome.js";
import { drawKpiCards, type Kpi } from "./pdf/kpiCards.js";
import { drawPaginatedTable, type TableColumn, type TableRow } from "./pdf/table.js";
import { drawCard, drawSectionHeading, formatDuration, truncate } from "./pdf/primitives.js";
import { COLORS, SIZES, paletteColor } from "./pdf/theme.js";

const CHART_INSET = 8;
const BAR_CHART_HEIGHT = 176;
const DONUT_HEIGHT = 186;

/**
 * Renders a `ReportData` snapshot as a designed PDF: a branded header,
 * summary cards, an hours/day bar chart, a distribution donut, a breakdown
 * table and a detailed entry list (`tck report pdf`, see SPEC.md's Reports
 * command). All drawing primitives live under `pdf/`, so this class only
 * decides what goes where.
 */
export class PdfReportExporter implements ReportExporter {
  async export(data: ReportData, outPath: string): Promise<void> {
    const doc = new PDFDocument({ size: "A4", margin: SIZES.pageMargin, bufferPages: true });
    const stream = createWriteStream(outPath);
    doc.pipe(stream);

    const left = SIZES.pageMargin;
    const width = doc.page.width - SIZES.pageMargin * 2;

    let y = drawHeaderBand(doc, {
      workspaceName: data.workspace.name,
      filterLabel: data.filterLabel,
      generatedAt: new Date(),
    });
    y = drawKpiCards(doc, PdfReportExporter.kpis(data), left, y, width);
    y = this.drawChartSection(
      doc,
      "Hours per day",
      chartSvg(data, width),
      y,
      left,
      width,
      BAR_CHART_HEIGHT,
    );
    y = this.drawChartSection(
      doc,
      "Distribution by project",
      donutSvg(data, width),
      y,
      left,
      width,
      DONUT_HEIGHT,
    );
    y = this.drawProjectBreakdown(doc, data, y, left, width);
    this.drawEntryDetail(doc, data, y, left, width);

    drawFooters(doc, data.workspace.name);
    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => {
        resolve();
      });
      stream.on("error", reject);
    });
  }

  /** A titled panel wrapping an SVG chart. Returns the `y` below the panel. */
  private drawChartSection(
    doc: PDFKit.PDFDocument,
    title: string,
    svg: string,
    y: number,
    x: number,
    width: number,
    chartHeight: number,
  ): number {
    const panelHeight = chartHeight + CHART_INSET * 2;
    const top = this.ensureSpace(doc, y, panelHeight + 34);
    const contentY = drawSectionHeading(doc, title, x, top);
    drawCard(doc, { x, y: contentY, width, height: panelHeight });
    SVGtoPDF(doc, svg, x + CHART_INSET, contentY + CHART_INSET, {
      width: width - CHART_INSET * 2,
      height: chartHeight,
      assumePt: true,
    });
    return contentY + panelHeight + SIZES.sectionGap;
  }

  private drawProjectBreakdown(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    y: number,
    x: number,
    width: number,
  ): number {
    const columns: TableColumn[] = [
      { header: "Project", weight: 2.4 },
      { header: "Hours", weight: 1, align: "right" },
      { header: "Billable", weight: 1, align: "right" },
      { header: "Amount", weight: 1.2, align: "right" },
      { header: "Share", weight: 1.4, align: "right" },
    ];
    const rows: TableRow[] = data.hoursByProject.map((project, index) => {
      const share = data.totalHours > 0 ? project.hours / data.totalHours : 0;
      return {
        cells: [
          { text: truncate(project.projectName, 34) },
          { text: formatDuration(project.hours) },
          { text: formatDuration(project.billableHours) },
          { text: project.amount.toDecimal().toFixed(2) },
          {
            text: `${(share * 100).toFixed(0)}%`,
            bar: { fraction: share, color: paletteColor(index) },
          },
        ],
      };
    });
    rows.push({
      emphasized: true,
      cells: [
        { text: "Total" },
        { text: formatDuration(data.totalHours) },
        { text: formatDuration(data.billableHours) },
        { text: data.billableAmount.toDecimal().toFixed(2) },
        { text: "100%" },
      ],
    });

    const top = this.ensureSpace(doc, y, 120);
    const contentY = drawSectionHeading(doc, "Breakdown by project", x, top);
    const bottom = drawPaginatedTable(
      doc,
      columns,
      rows,
      x,
      contentY,
      width,
      this.bottomLimit(doc),
    );
    return bottom + SIZES.sectionGap;
  }

  private drawEntryDetail(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    y: number,
    x: number,
    width: number,
  ): void {
    if (data.entries.length === 0) return;

    const columns: TableColumn[] = [
      { header: "Date", weight: 1.1 },
      { header: "Description", weight: 3 },
      { header: "Project", weight: 1.5 },
      { header: "Duration", weight: 1, align: "right" },
      { header: "Amount", weight: 1, align: "right" },
    ];
    const rows: TableRow[] = [...data.entries]
      .sort((a, b) => a.startTs.getTime() - b.startTs.getTime())
      .map((entry) => ({
        cells: [
          { text: formatEntryDate(entry) },
          { text: truncate(entry.description, 44) },
          {
            text: truncate(
              entry.projectId ? (data.projectNameById.get(entry.projectId) ?? "—") : "—",
              20,
            ),
          },
          { text: formatDuration(data.hoursByEntryId.get(entry.id) ?? entry.durationHours()) },
          { text: data.amountByEntryId.get(entry.id)?.toDecimal().toFixed(2) ?? "—" },
        ],
      }));

    const top = this.ensureSpace(doc, y, 120);
    const contentY = drawSectionHeading(doc, `Entries (${data.entries.length})`, x, top);
    drawPaginatedTable(doc, columns, rows, x, contentY, width, this.bottomLimit(doc));
  }

  /** Starts a new page when `needed` points below the printable area. */
  private ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
    if (y + needed <= this.bottomLimit(doc)) return y;
    doc.addPage();
    return doc.page.margins.top;
  }

  private bottomLimit(doc: PDFKit.PDFDocument): number {
    // Leave room for the footer rule drawn on every page.
    return doc.page.height - SIZES.pageMargin - 18;
  }

  private static kpis(data: ReportData): Kpi[] {
    const billableShare =
      data.totalHours > 0
        ? `${((data.billableHours / data.totalHours) * 100).toFixed(0)}% of total`
        : "—";
    // `--hide-rounding` drops the note entirely rather than claiming the
    // durations are exact.
    const roundingHint = !data.showRounding
      ? undefined
      : data.rounding.isEnabled
        ? `rounded ${data.rounding.describe()}`
        : "exact durations";
    return [
      {
        label: "Total tracked",
        value: formatDuration(data.totalHours),
        hint: `${data.entries.length} entries`,
        accent: COLORS.brand,
      },
      {
        label: "Billable",
        value: formatDuration(data.billableHours),
        hint: billableShare,
        accent: COLORS.positive,
      },
      { label: "Non-billable", value: formatDuration(data.nonBillableHours), accent: COLORS.faint },
      {
        label: `Amount (${data.billableAmount.currency})`,
        value: data.billableAmount.toDecimal().toFixed(2),
        ...(roundingHint ? { hint: roundingHint } : {}),
        accent: COLORS.brandDark,
      },
    ];
  }
}

function chartSvg(data: ReportData, width: number): string {
  return renderBarChart(dailyBars(data), {
    width: width - CHART_INSET * 2,
    height: BAR_CHART_HEIGHT,
    unit: "h",
  });
}

function donutSvg(data: ReportData, width: number): string {
  return renderDonutChart(
    data.hoursByProject.map((p) => ({ label: p.projectName, value: p.hours })),
    {
      width: width - CHART_INSET * 2,
      height: DONUT_HEIGHT,
      centerValue: formatDuration(data.totalHours),
      centerLabel: "tracked",
    },
  );
}

/** Labels days by number, spelling out the month at each month boundary. */
function dailyBars(data: ReportData): BarChartDatum[] {
  return data.hoursByDay.map((day, index) => {
    const date = parseLocalIsoDate(day.date);
    const dayOfMonth = date.getDate();
    const showMonth = index === 0 || dayOfMonth === 1;
    return {
      label: showMonth
        ? `${date.toLocaleString("en", { month: "short" })} ${dayOfMonth}`
        : String(dayOfMonth),
      value: day.hours,
      muted: date.getDay() === 0 || date.getDay() === 6,
      alwaysLabel: showMonth,
    };
  });
}

function formatEntryDate(entry: TimeEntry): string {
  return entry.startTs.toLocaleDateString("en-CA"); // YYYY-MM-DD, locale-stable
}

function parseLocalIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}
