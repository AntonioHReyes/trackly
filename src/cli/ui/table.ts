import { bold, dim, truncate, visibleWidth } from "./ansi.js";

export type Align = "left" | "right";

export interface Column {
  header: string;
  align?: Align;
  /** Caps the column's width, ellipsizing overflowing cells (header is left untouched). */
  maxWidth?: number;
}

export interface TableOptions {
  /** Optional totals row rendered under a rule at the bottom; style its cells yourself. */
  footer?: string[];
}

const GAP = "  ";
const INDENT = " ";

function pad(cell: string, width: number, align: Align): string {
  const filler = " ".repeat(Math.max(width - visibleWidth(cell), 0));
  return align === "right" ? filler + cell : cell + filler;
}

function normalize(columns: Array<Column | string>): Column[] {
  return columns.map((c) => (typeof c === "string" ? { header: c } : c));
}

/**
 * Renders rows as an ANSI-aware, space-padded table: bold headers, a dim
 * rule underneath, and per-column alignment (numbers read best right-aligned).
 * Cells may already contain escape codes; widths are computed on visible text.
 */
export function renderTable(
  columns: Array<Column | string>,
  rows: string[][],
  options: TableOptions = {},
): string {
  const cols = normalize(columns);
  const allRows = options.footer ? [...rows, options.footer] : rows;
  const clip = (cell: string, col?: Column): string =>
    col?.maxWidth ? truncate(cell, col.maxWidth) : cell;
  const widths = cols.map((col, i) =>
    Math.max(
      visibleWidth(col.header),
      ...allRows.map((row) => visibleWidth(clip(row[i] ?? "", col))),
    ),
  );
  const line = (cells: string[], style: (s: string) => string = (s) => s): string =>
    INDENT +
    cells
      .map((cell, i) =>
        pad(cell === "" ? cell : style(clip(cell, cols[i])), widths[i] ?? 0, cols[i]?.align ?? "left"),
      )
      .join(GAP)
      .trimEnd();
  const rule = (): string => line(widths.map((w) => dim("─".repeat(w))));

  const out = [
    line(
      cols.map((c) => c.header),
      bold,
    ),
    rule(),
    ...rows.map((row) => line(row)),
  ];
  if (options.footer) {
    out.push(rule(), line(options.footer));
  }
  return out.join("\n");
}

/** Two-column label/value block for a single record (`tck status`). */
export function renderDetails(entries: Array<[label: string, value: string]>): string {
  const width = Math.max(...entries.map(([label]) => label.length));
  return entries
    .map(([label, value]) => `${INDENT}${dim(label.padEnd(width))}  ${value}`)
    .join("\n");
}
