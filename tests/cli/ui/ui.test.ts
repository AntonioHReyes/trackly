import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bold,
  formatDuration,
  formatHours,
  hexColor,
  isColorEnabled,
  renderDetails,
  renderTable,
  setColorEnabled,
  shortId,
  stripAnsi,
  visibleWidth,
} from "../../../src/cli/ui/index.js";

describe("ansi", () => {
  let previous: boolean;
  beforeEach(() => {
    previous = isColorEnabled();
  });
  afterEach(() => {
    setColorEnabled(previous);
  });

  it("wraps text in SGR codes only when colour is enabled", () => {
    setColorEnabled(true);
    expect(bold("x")).toBe("[1mx[22m");
    setColorEnabled(false);
    expect(bold("x")).toBe("x");
  });

  it("emits 24-bit colour for valid hex and passes through otherwise", () => {
    setColorEnabled(true);
    expect(hexColor("#ff8800")("■")).toBe("[38;2;255;136;0m■[39m");
    expect(hexColor("orange")("■")).toBe("■");
  });

  it("measures visible width ignoring escape codes", () => {
    setColorEnabled(true);
    expect(visibleWidth(bold("héllo"))).toBe(5);
    expect(visibleWidth("✨ 日本")).toBe(6);
    expect(visibleWidth("e\u0301")).toBe(1);
    expect(stripAnsi(bold("a"))).toBe("a");
  });
});

describe("formatDuration", () => {
  it("renders hours and zero-padded minutes", () => {
    expect(formatDuration(0)).toBe("<1m");
    expect(formatDuration(59_000)).toBe("<1m");
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(2 * 3_600_000)).toBe("2h");
    expect(formatDuration(3_600_000 + 5 * 60_000)).toBe("1h 05m");
  });

  it("formats decimal hours and short ids", () => {
    expect(formatHours(90 * 60_000)).toBe("1.50h");
    expect(shortId("3f2a9c1d-0000-4000-8000-000000000000")).toBe("3f2a9c1d");
  });
});

describe("renderTable", () => {
  beforeEach(() => setColorEnabled(false));

  it("pads columns on visible width and right-aligns when asked", () => {
    const out = renderTable(
      ["Name", { header: "Hours", align: "right" }],
      [
        ["alpha", "1.5"],
        ["b", "12.25"],
      ],
    );
    expect(out.split("\n")).toEqual([
      " Name   Hours",
      " ─────  ─────",
      " alpha    1.5",
      " b      12.25",
    ]);
  });

  it("appends a ruled footer row", () => {
    const out = renderTable(["A"], [["x"]], { footer: ["total"] });
    expect(out.split("\n")).toEqual([" A", " ─────", " x", " ─────", " total"]);
  });

  it("ignores escape codes when computing widths", () => {
    setColorEnabled(true);
    const out = renderTable(["Name"], [[bold("ab")], ["abcd"]]);
    const widths = out.split("\n").map((line) => visibleWidth(line));
    expect(widths).toEqual([5, 5, 3, 5]);
  });
});

describe("renderDetails", () => {
  it("aligns values after the longest label", () => {
    setColorEnabled(false);
    expect(
      renderDetails([
        ["ID", "1"],
        ["Description", "fix"],
      ]),
    ).toBe(" ID           1\n Description  fix");
  });
});
