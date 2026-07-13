import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseManualList, dedupe, validate, parseSpreadsheet, normalizeEmail } from "./recipients";

describe("recipients", () => {
  it("parseManualList splits on commas, spaces and newlines", () => {
    expect(parseManualList("a@x.com, b@y.com\n c@z.com").map((r) => r.email))
      .toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });
  it("dedupe is case-insensitive, keeps first", () => {
    const out = dedupe([{ email: "A@x.com", mergeData: {} }, { email: "a@x.com", mergeData: {} }]);
    expect(out).toHaveLength(1);
    expect(out[0].email).toBe("a@x.com");
  });
  it("validate separates good from bad", () => {
    const { valid, invalid } = validate([{ email: "ok@x.com", mergeData: {} }, { email: "nope", mergeData: {} }]);
    expect(valid.map((v) => v.email)).toEqual(["ok@x.com"]);
    expect(invalid).toEqual(["nope"]);
  });
  it("parseSpreadsheet finds the email column and keeps other cols as merge data", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Email", "Contact Name"], ["v@x.com", "Sam"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = parseSpreadsheet(buf);
    expect(rows[0].email).toBe(normalizeEmail("v@x.com"));
    expect(rows[0].mergeData["contact name"]).toBe("Sam");
  });
});
