import { describe, expect, it } from "vitest";
import { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import { ValidationError, InvalidStateError } from "../../../src/domain/errors/DomainError.js";

describe("TimeEntry", () => {
  it("start() creates a running entry", () => {
    const entry = TimeEntry.start({ workspaceId: "ws-1", description: "Coding" });
    expect(entry.isRunning()).toBe(true);
    expect(entry.endTs).toBeNull();
    expect(entry.source).toBe("manual");
  });

  it("rejects an empty description", () => {
    expect(() => TimeEntry.start({ workspaceId: "ws-1", description: " " })).toThrow(
      ValidationError,
    );
  });

  it("stop() finishes a running entry", () => {
    const start = new Date("2026-01-01T09:00:00Z");
    const entry = TimeEntry.start({ workspaceId: "ws-1", description: "Coding", startTs: start });
    const end = new Date("2026-01-01T10:00:00Z");
    const stopped = entry.stop(end);
    expect(stopped.isRunning()).toBe(false);
    expect(stopped.durationHours()).toBe(1);
  });

  it("stop() refuses to stop an already-stopped entry", () => {
    const entry = TimeEntry.addManual({
      workspaceId: "ws-1",
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    expect(() => entry.stop()).toThrow(InvalidStateError);
  });

  it("addManual() rejects an end before start", () => {
    expect(() =>
      TimeEntry.addManual({
        workspaceId: "ws-1",
        description: "Coding",
        startTs: new Date("2026-01-01T10:00:00Z"),
        endTs: new Date("2026-01-01T09:00:00Z"),
      }),
    ).toThrow(ValidationError);
  });

  it("attachGit() sets git metadata and flips the source", () => {
    const entry = TimeEntry.addManual({
      workspaceId: "ws-1",
      description: "Coding",
      startTs: new Date("2026-01-01T09:00:00Z"),
      endTs: new Date("2026-01-01T10:00:00Z"),
    });
    const withGit = entry.attachGit({ repo: "trackly", commit: "abc123", branch: "main" });
    expect(withGit.source).toBe("git-hook");
    expect(withGit.git).toEqual({ repo: "trackly", commit: "abc123", branch: "main" });
  });

  it("durationHours() measures a running entry against `now`", () => {
    const start = new Date("2026-01-01T09:00:00Z");
    const entry = TimeEntry.start({ workspaceId: "ws-1", description: "Coding", startTs: start });
    const now = new Date("2026-01-01T11:30:00Z");
    expect(entry.durationHours(now)).toBe(2.5);
  });
});
