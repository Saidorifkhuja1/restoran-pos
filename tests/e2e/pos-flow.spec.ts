import { expect, test } from "@playwright/test";

test("POS PIN login opens role workspace", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) });
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          user: { id: "admin-1", name: "Demo Admin", role: "ADMIN" },
          restaurant: { id: "demo-restaurant", name: "Demo Resto", currency: "UZS", taxPercent: 12 },
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
  await page.getByLabel("Restaurant ID").fill("demo-restaurant");
  await page.getByLabel("PIN").fill("1111");
  await page.getByRole("button", { name: /Kirish/i }).click();
  await expect(page).toHaveURL(/\/tables/);
  await expect(page.getByText("Stol 1")).toBeVisible();
});
