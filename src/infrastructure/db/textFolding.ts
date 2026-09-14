import type { Database } from "better-sqlite3";

/** Name of the SQL function registered by `registerTextFolding`. */
export const FOLD_ACCENTS_SQL_FN = "fold_accents";

/**
 * Strips diacritics so "sesión" and "sesion" are the same string — SQLite's
 * built-in `LIKE` only folds case, and only for ASCII.
 *
 * Decomposing (NFD) splits an accented letter into its base letter plus a
 * combining mark, which is then dropped; `ñ` folds to `n` as a consequence,
 * which is what a "type it without accents" search wants.
 */
export function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Exposes `foldAccents` to SQL, so queries can compare folded text. It runs
 * per scanned row, which is fine for the substring searches it backs — those
 * can't use an index anyway.
 */
export function registerTextFolding(db: Database): void {
  db.function(FOLD_ACCENTS_SQL_FN, { deterministic: true }, (value: unknown) =>
    typeof value === "string" ? foldAccents(value) : value === null ? null : String(value),
  );
}
