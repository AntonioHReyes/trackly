/**
 * Terminal presentation layer for the CLI: colors, tables, message
 * primitives and value formatters. Commands import from here and never
 * call `console` directly, so output style lives in exactly one place.
 */
export * from "./ansi.js";
export * from "./format.js";
export * from "./table.js";
export * from "./messages.js";
