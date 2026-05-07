import { describe, expect, it } from "vitest";
import { calculateChange, generateOrderNumber } from "./index";

describe("POS utils", () => {
  it("formats restaurant-scoped order number", () => {
    expect(generateOrderNumber(7)).toBe("0007");
  });

  it("never returns negative cash change", () => {
    expect(calculateChange(10_000, 12_000)).toBe(0);
    expect(calculateChange(20_000, 12_000)).toBe(8_000);
  });
});
