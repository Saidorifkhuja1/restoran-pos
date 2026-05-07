import { describe, expect, it } from "vitest";
import { defaultPathForRole } from "./AuthGuard";
import { UserRole } from "@restopos/types";

describe("role redirects", () => {
  it("routes each POS role to its default workspace", () => {
    expect(defaultPathForRole(UserRole.ADMIN)).toBe("/admin");
    expect(defaultPathForRole(UserRole.MANAGER)).toBe("/admin");
    expect(defaultPathForRole(UserRole.WAITER)).toBe("/tables");
    expect(defaultPathForRole(UserRole.KITCHEN)).toBe("/kitchen");
    expect(defaultPathForRole(UserRole.CASHIER)).toBe("/cashier");
    expect(defaultPathForRole("SUPERADMIN")).toBe("/superadmin");
  });
});
