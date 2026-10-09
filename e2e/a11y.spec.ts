import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ready, skipTour, VIEWER_ROUTES } from "./helpers";

// Automated WCAG 2.x A/AA checks (axe-core). These catch many, not all, problems:
// they cannot judge screen-reader wording or reading order.
for (const theme of ["dark", "light"] as const) {
  test(`axe: Viewer routes and public pages have no A/AA violations (${theme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await skipTour(page);
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const failures: string[] = [];
    for (const path of ["/", "/login", ...VIEWER_ROUTES]) {
      await page.goto(path);
      await ready(page);
      await page.waitForTimeout(400);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of violations) failures.push(`${path} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(failures).toEqual([]);
  });
}

test("axe: tour card, a dialog and the search palette", async ({ page }) => {
  await page.goto("/viewer/finance");
  const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
  await expect(tour).toBeVisible();
  const scan = async () => (await page.waitForTimeout(700), await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0].target.join(" ")}`);
  expect(await scan()).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Review" }).first().click();
  await expect(page.getByRole("dialog", { name: "Review expense claim" })).toBeVisible();
  expect(await scan()).toEqual([]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search the demo" })).toBeVisible();
  expect(await scan()).toEqual([]);
});
