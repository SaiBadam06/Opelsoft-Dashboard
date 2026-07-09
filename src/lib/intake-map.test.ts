import { describe, it, expect } from "vitest";
import { matchVendorId, toFormValues, type ExtractedRequirement } from "./intake-map";

const VENDORS = [
  { id: "v1", name: "TechServe Inc" },
  { id: "v2", name: "Apex Global" },
];

describe("matchVendorId", () => {
  it("matches case/punctuation-insensitively", () => {
    expect(matchVendorId("techserve inc.", VENDORS)).toBe("v1");
    expect(matchVendorId("APEX GLOBAL", VENDORS)).toBe("v2");
  });
  it("matches on substring", () => {
    expect(matchVendorId("Apex", VENDORS)).toBe("v2");
  });
  it("returns null when unknown or empty", () => {
    expect(matchVendorId("Unknown Vendor", VENDORS)).toBeNull();
    expect(matchVendorId(null, VENDORS)).toBeNull();
    expect(matchVendorId("   ", VENDORS)).toBeNull();
  });
});

describe("toFormValues", () => {
  const ex: ExtractedRequirement = {
    title: "Senior React Developer",
    location: "Austin, TX",
    end_client: "BigCo",
    vendor_name: "TechServe",
    rate: "$70/hr",
    duration: "12 months",
    work_mode: "hybrid",
    must_have_skills: ["React", "TypeScript"],
    nice_to_have_skills: ["GraphQL"],
    work_authorization: "USC/GC only",
    submission_deadline: "2026-07-15",
    contact_name: "Jane Doe",
    contact_email: "jane@techserve.example",
  };

  it("maps every extracted field to the form and resolves the vendor", () => {
    const f = toFormValues(ex, VENDORS);
    expect(f.title).toBe("Senior React Developer");
    expect(f.skills).toEqual(["React", "TypeScript"]);
    expect(f.nice_to_have_skills).toEqual(["GraphQL"]);
    expect(f.closing_date).toBe("2026-07-15");
    expect(f.vendor_id).toBe("v1");
    expect(f.vendor_name).toBe("TechServe");
    expect(f.priority).toBe("medium");
    expect(f.status).toBe("open");
  });

  it("uses empty strings (not null) for missing fields", () => {
    const f = toFormValues({ ...ex, title: null, nice_to_have_skills: null, vendor_name: null }, VENDORS);
    expect(f.title).toBe("");
    expect(f.nice_to_have_skills).toEqual([]);
    expect(f.vendor_id).toBe("");
  });
});
