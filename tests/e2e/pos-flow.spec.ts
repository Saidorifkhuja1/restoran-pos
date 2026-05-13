import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signTestJwt(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-do-not-use-in-prod";
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    })
  );
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

test("POS login opens role workspace", async ({ page }) => {
  let loggedIn = false;
  const user = { id: "admin-1", name: "Demo Admin", role: "ADMIN" };
  const restaurant = { id: "demo-restaurant", name: "Demo Resto", currency: "UZS", taxPercent: 12 };
  const token = signTestJwt({ role: "ADMIN", userId: user.id, restaurantId: restaurant.id });

  await page.route("**/api/auth/me", async (route) => {
    if (!loggedIn) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user, restaurant } }),
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    loggedIn = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Set-Cookie": `restopos-token=${token}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        success: true,
        data: {
          user,
          restaurant,
        },
      }),
    });
  });
  await page.route("**/api/shifts/current", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: null }) });
  });
  await page.route("**/api/restaurants/demo-restaurant/tables?limit=100", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { items: [{ id: "t1", number: 1, capacity: 4, status: "FREE", zone: { id: "z1", name: "Asosiy zal", color: "#0f766e" } }], total: 1, page: 1, limit: 100 },
      }),
    });
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "RestoPOS" })).toBeVisible();
  await page.getByLabel("Login").fill("admin");
  await page.getByLabel("Parol").fill("1111");
  await page.getByRole("button", { name: /Kirish/i }).click();
  await expect(page).toHaveURL(/\/tables/);
  await expect(page.getByText("Stol 1")).toBeVisible();
});
