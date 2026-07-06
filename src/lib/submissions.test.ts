import { describe, it, expect } from "vitest";
import { parseLogFilters } from "@/lib/submissions";

describe("parseLogFilters", () => {
  it("returns empty object when no params", () => {
    expect(parseLogFilters({})).toEqual({});
  });

  it("keeps a valid status", () => {
    expect(parseLogFilters({ status: "placed" })).toEqual({ status: "placed" });
  });

  it("drops an invalid status", () => {
    expect(parseLogFilters({ status: "bogus" })).toEqual({});
  });

  it("keeps candidate, from, to", () => {
    expect(
      parseLogFilters({ candidate: "abc", from: "2026-01-01", to: "2026-02-01" })
    ).toEqual({ candidate: "abc", from: "2026-01-01", to: "2026-02-01" });
  });

  it("takes the first value when a param is an array", () => {
    expect(parseLogFilters({ status: ["submitted", "placed"] })).toEqual({
      status: "submitted",
    });
  });

  it("ignores empty strings", () => {
    expect(parseLogFilters({ candidate: "", status: "" })).toEqual({});
  });

  it("ignores extra keys", () => {
    expect(parseLogFilters({ other: "value", status: "submitted" })).toEqual({
      status: "submitted",
    });
  });
});
