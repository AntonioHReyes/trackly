import { bold, cyan, dim, green, red, yellow } from "./ansi.js";

const SYMBOL = {
  success: green("✔"),
  error: red("✖"),
  warn: yellow("▲"),
  info: cyan("●"),
  hint: dim("→"),
} as const;

export function success(message: string): void {
  console.log(`${SYMBOL.success} ${message}`);
}

export function info(message: string): void {
  console.log(`${SYMBOL.info} ${message}`);
}

export function warn(message: string): void {
  console.log(`${SYMBOL.warn} ${message}`);
}

/** Written to stderr so it never pollutes piped output. */
export function error(message: string): void {
  console.error(`${SYMBOL.error} ${red(message)}`);
}

/** A muted follow-up line (next step, shortcut) shown under a message. */
export function hint(message: string): void {
  console.log(`${SYMBOL.hint} ${dim(message)}`);
}

/** Empty-state line, optionally followed by a hint on how to fix it. */
export function empty(message: string, next?: string): void {
  console.log(dim(message));
  if (next) hint(next);
}

/** Section heading printed before a table. */
export function heading(title: string, subtitle?: string): void {
  console.log(subtitle ? `${bold(title)} ${dim(subtitle)}` : bold(title));
}

/** Highlights a name inline: `Started ${em("Fix login")}`. */
export function em(text: string): string {
  return bold(text);
}

/** Highlights a file path or command inline. */
export function code(text: string): string {
  return cyan(text);
}

/** Prints raw pre-rendered output (tables, detail blocks). */
export function print(text: string): void {
  console.log(text);
}

export function blank(): void {
  console.log();
}
