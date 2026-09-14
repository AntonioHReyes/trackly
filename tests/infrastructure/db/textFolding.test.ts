import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  FOLD_ACCENTS_SQL_FN,
  foldAccents,
  registerTextFolding,
} from "../../../src/infrastructure/db/textFolding.js";

describe("foldAccents", () => {
  it("strips diacritics while keeping the base letters", () => {
    expect(foldAccents("sesión")).toBe("sesion");
    expect(foldAccents("Año Nuevo")).toBe("Ano Nuevo");
    expect(foldAccents("Café àéîõü")).toBe("Cafe aeiou");
  });

  it("leaves unaccented text untouched", () => {
    expect(foldAccents("checkout bug")).toBe("checkout bug");
    expect(foldAccents("")).toBe("");
  });
});

describe("registerTextFolding", () => {
  it("exposes the folding to SQL, passing null through", () => {
    const db = new Database(":memory:");
    registerTextFolding(db);

    const fold = (value: string | null): unknown =>
      db.prepare(`SELECT ${FOLD_ACCENTS_SQL_FN}(?) AS folded`).get(value) as { folded: unknown };

    expect(fold("sesión")).toEqual({ folded: "sesion" });
    expect(fold(null)).toEqual({ folded: null });
    db.close();
  });
});
