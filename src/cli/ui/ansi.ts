/**
 * Minimal ANSI styling — no dependency, honours `NO_COLOR`, `FORCE_COLOR`
 * and non-TTY output (pipes/redirects get plain text so scripts stay clean).
 */

const ESC = "[";

function detectColorSupport(): boolean {
  const env = process.env;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") return true;
  if (env.TERM === "dumb") return false;
  return Boolean(process.stdout.isTTY);
}

let colorEnabled = detectColorSupport();

/** Test hook / `--no-color` style override. */
export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

export function isColorEnabled(): boolean {
  return colorEnabled;
}

export type Styler = (text: string) => string;

function sgr(open: number, close: number): Styler {
  return (text) => (colorEnabled ? `${ESC}${open}m${text}${ESC}${close}m` : text);
}

export const bold = sgr(1, 22);
export const dim = sgr(2, 22);
export const italic = sgr(3, 23);
export const underline = sgr(4, 24);
export const red = sgr(31, 39);
export const green = sgr(32, 39);
export const yellow = sgr(33, 39);
export const blue = sgr(34, 39);
export const magenta = sgr(35, 39);
export const cyan = sgr(36, 39);
export const gray = sgr(90, 39);

/** 24-bit foreground color from a `#rrggbb` hex string; falls back to plain text. */
export function hexColor(hex: string): Styler {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return (text) => text;
  const value = Number.parseInt(match[1] as string, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (text) => (colorEnabled ? `${ESC}38;2;${r};${g};${b}m${text}${ESC}39m` : text);
}

const ANSI_PATTERN = /\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

/** Emoji and East Asian wide/fullwidth ranges occupy two terminal cells. */
const WIDE_PATTERN =
  /[\u{1100}-\u{115F}\u{2E80}-\u{A4CF}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FE30}-\u{FE4F}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;
const ZERO_WIDTH_PATTERN = /[\u{200B}-\u{200D}\u{FE0F}\u{0300}-\u{036F}]/u;

/** Printable width in terminal cells once escape codes are removed. */
export function visibleWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) {
    if (ZERO_WIDTH_PATTERN.test(char)) continue;
    width += WIDE_PATTERN.test(char) ? 2 : 1;
  }
  return width;
}

/** Cuts plain text to `maxWidth` cells, adding an ellipsis when it overflows. */
export function truncate(text: string, maxWidth: number): string {
  if (visibleWidth(text) <= maxWidth) return text;
  if (maxWidth <= 1) return "…";
  let width = 0;
  let result = "";
  for (const char of stripAnsi(text)) {
    if (ZERO_WIDTH_PATTERN.test(char)) continue;
    const charWidth = WIDE_PATTERN.test(char) ? 2 : 1;
    if (width + charWidth > maxWidth - 1) break;
    result += char;
    width += charWidth;
  }
  return `${result}…`;
}
