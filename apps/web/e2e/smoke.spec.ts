import { test, expect } from "@playwright/test";

test("home page loads with logo and leaderboard", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 }).or(page.locator("svg")).first()).toBeVisible();
  await expect(page.getByText(/leaderboard|rebríček|scoreboard/i).first()).toBeVisible({
    timeout: 15000,
  });
});

test("signup page is reachable", async ({ page }) => {
  await page.goto("/en/auth/signup");
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
});
