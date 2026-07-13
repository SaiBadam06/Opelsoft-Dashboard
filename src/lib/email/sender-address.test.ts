import { describe, it, expect, beforeEach } from "vitest";
import { senderFor } from "./sender-address";

beforeEach(() => {
  process.env.EMAIL_SENDER_ADDRESSES = "alex.smith@opelsoft.com,careers@opelsoft.com";
});

describe("senderFor", () => {
  it("admins always send from the shared outreach mailbox", () => {
    expect(senderFor({ email: "harsh@opelsoft.com", role: "admin" })).toBe("alex.smith@opelsoft.com");
  });
  it("coordinators send as their own @opelsoft.com mailbox", () => {
    expect(senderFor({ email: "Harsh@Opelsoft.com", role: "coordinator" })).toBe("harsh@opelsoft.com");
  });
  it("non-opelsoft logins fall back to the shared mailbox", () => {
    expect(senderFor({ email: "someone@gmail.com", role: "coordinator" })).toBe("alex.smith@opelsoft.com");
  });
  it("returns null when nothing is configured and no opelsoft mailbox", () => {
    process.env.EMAIL_SENDER_ADDRESSES = "";
    expect(senderFor({ email: "someone@gmail.com", role: "coordinator" })).toBeNull();
    expect(senderFor({ email: "shiva@opelsoft.com", role: "coordinator" })).toBe("shiva@opelsoft.com");
  });
});
