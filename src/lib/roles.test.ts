import { describe, it, expect } from "vitest";
import { canAccess, NAV_ITEMS } from "@/lib/roles";

describe("canAccess", () => {
  it("lets admin access an admin-only item", () => {
    expect(canAccess("admin", "admin")).toBe(true);
  });
  it("blocks coordinator from an admin-only item", () => {
    expect(canAccess("coordinator", "admin")).toBe(false);
  });
  it("lets both roles access a shared item", () => {
    expect(canAccess("coordinator", "any")).toBe(true);
    expect(canAccess("admin", "any")).toBe(true);
  });
});

describe("NAV_ITEMS", () => {
  it("includes a Users item restricted to admin", () => {
    const users = NAV_ITEMS.find((i) => i.href === "/users");
    expect(users?.minRole).toBe("admin");
  });

  it("includes a Submission Logs item restricted to admin", () => {
    const logs = NAV_ITEMS.find((i) => i.href === "/logs");
    expect(logs?.minRole).toBe("admin");
  });
});
