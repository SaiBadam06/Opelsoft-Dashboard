import { describe, it, expect } from "vitest";
import { applyMergeFields, unsubscribeUrl, buildOutbound } from "./render";

describe("applyMergeFields", () => {
  it("replaces known fields and blanks unknown/empty", () => {
    expect(applyMergeFields("Dear {{contact_name}}", { contact_name: "Sam" })).toBe("Dear Sam");
    expect(applyMergeFields("Dear {{contact_name}}", {})).toBe("Dear ");
  });
});

describe("buildOutbound", () => {
  it("merges, appends footer with address + unsubscribe, and sets List-* headers", () => {
    const url = unsubscribeUrl("https://app.test/", "tok123");
    const msg = buildOutbound({
      from: "a@opelsoft.com", replyTo: "h@opelsoft.com", to: "v@x.com",
      subject: "Hi {{contact_name}}", bodyTemplate: "<p>Hello {{contact_name}}</p>",
      mergeData: { contact_name: "Sam" }, unsubUrl: url,
    });
    expect(msg.subject).toBe("Hi Sam");
    expect(msg.html).toContain("Hello Sam");
    expect(msg.html).toContain("Piscataway");
    expect(msg.html).toContain(url);
    expect(msg.headers?.["List-Unsubscribe"]).toBe(`<${url}>`);
    expect(msg.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
