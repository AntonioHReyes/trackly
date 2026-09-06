import { describe, expect, it } from "vitest";
import { Tag } from "../../../src/domain/entities/Tag.js";
import { ValidationError } from "../../../src/domain/errors/DomainError.js";

describe("Tag", () => {
  it("creates a tag with a generated id", () => {
    const tag = Tag.create({ workspaceId: "ws-1", name: "billable" });
    expect(tag.id).toBeTruthy();
    expect(tag.name).toBe("billable");
  });

  it("rejects an empty name", () => {
    expect(() => Tag.create({ workspaceId: "ws-1", name: "  " })).toThrow(ValidationError);
  });
});
