import { describe, expect, it } from "vitest";
import { qrSvgDataUri, receiptQrPayload } from "./receipt";

describe("receipt helpers", () => {
  it("builds encoded receipt URL", () => {
    process.env.PUBLIC_APP_URL = "https://pos.example.com";
    expect(receiptQrPayload("#0001", "order 1")).toBe("https://pos.example.com/receipt/order%201?receipt=%230001");
  });

  it("returns svg data uri", () => {
    const uri = qrSvgDataUri("hello");
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });
});
