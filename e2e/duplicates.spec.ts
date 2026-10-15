import { expect, test } from "@playwright/test";
import { ready, skipTour, VIEWER_ROUTES } from "./helpers";

// One owner per control. A page must not repeat what the shell already offers:
// the landing page once showed "Sign in" in the corner and again beside the
// hero button. These tests pin the ownership rules.

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

for (const [name, size] of [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["phone", { width: 390, height: 844 }],
  ["small phone", { width: 360, height: 740 }],
] as const) {
  test(`landing page: Sign in has one owner, the header (${name})`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await ready(page);
    const header = page.locator("header").first();
    // Visible Sign in links outside the footer sitemap: exactly one, in the header.
    const visibleOutsideFooter = await page
      .getByRole("link", { name: "Sign in", exact: true })
      .evaluateAll((els) => els.filter((e) => !e.closest("footer") && (e as HTMLElement).offsetParent !== null).length);
    expect(visibleOutsideFooter).toBe(1);
    await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    // The page body offers the demo and account creation instead.
    await expect(page.locator("main").getByRole("link", { name: "Explore the Platform" }).first()).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Create an account" }).first()).toBeVisible();
    await expect(header.getByRole("link", { name: /Explore/ })).toHaveCount(1);
    // No horizontal scrolling.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("landing page: the mobile menu does not repeat the header Sign in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Create an account" })).toBeVisible();
});

test("sign in and register pages show their action once", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveCount(0);
});

test.describe("Explore Mode pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const path of VIEWER_ROUTES) {
    test(`${path}: one page title, no repeated menu entries or account controls`, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      await expect(page.locator("main h1")).toHaveCount(1);
      // Each destination appears once in the sidebar menu.
      const hrefs = await page.locator("aside nav a").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      // The way out and the way into the real app each appear once.
      await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(1);
      await expect(page.getByRole("link", { name: /Exit Viewer/ })).toHaveCount(1);
      // One perspective switch.
      await expect(page.getByRole("group", { name: "Choose a perspective" })).toHaveCount(1);
    });
  }
});
