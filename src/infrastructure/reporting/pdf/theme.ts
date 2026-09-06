/**
 * The single source of truth for the report's look: colors, type sizes and
 * spacing. Chart renderers and page sections both read from here so the SVG
 * charts and the PDF-drawn chrome stay visually consistent.
 */
export const COLORS = {
  brand: "#4f46e5",
  brandDark: "#3730a3",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  grid: "#eef2f7",
  surface: "#f8fafc",
  zebra: "#fbfcfe",
  white: "#ffffff",
  positive: "#0d9488",
} as const;

/** Cycled by index for project slices, legend swatches and share bars. */
export const CHART_PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
] as const;

export const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
} as const;

export const SIZES = {
  pageMargin: 44,
  headerHeight: 104,
  sectionGap: 22,
  cardRadius: 8,
} as const;

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] as string;
}
