import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("hero, calls to action and every link point somewhere real", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every campus issue.");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator('a[href="#"], a[href=""]').count()).toBe(0);
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    for (const h of hrefs) expect(h).toMatch(/^(#[a-z-]+|\/(viewer(\/[a-z-]+)?|login|register)?)$/);
    // Every in-page anchor has a target.
    for (const h of hrefs.filter((x) => x.startsWith("#"))) expect(await page.locator(h).count(), h).toBe(1);
    await page.getByRole("main").getByRole("link", { name: "Explore the Platform" }).first().click();
    await expect(page).toHaveURL(/\/viewer$/);
  });

  test("Sign in, Register and the logo go to the right places", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await page.getByRole("contentinfo").getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.goBack();
    await page.getByRole("contentinfo").getByRole("link", { name: "Live demo" }).click();
    await expect(page).toHaveURL(/\/viewer$/);
    await page.goto("/login");
    await page.getByRole("link", { name: "UniFix" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every campus issue.");
  });

  test("the footer carries the exact attribution and nothing about a hackathon", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText("Built with love by SoloDev", { exact: true })).toBeVisible();
    expect((await page.locator("body").innerText()).toLowerCase()).not.toContain("hackathon");
  });

  test("section links scroll their heading below the sticky bar", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    for (const [name, id] of [["Workflow", "workflow"], ["Capabilities", "capabilities"], ["Live demo", "demo"]] as const) {
      await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect.poll(async () => (await page.locator(`#${id} h2`).boundingBox())?.y ?? -1).toBeGreaterThan(60);
    }
  });

  test("mobile menu opens, traps focus, closes with Escape and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open menu" });
    await expect(open).toBeVisible(); // not pushed off screen
    const box = await open.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    await open.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Explore the Platform" })).toBeVisible();
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await menu.getByRole("link", { name: "Workflow" }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#workflow$/);
  });

  test("the theme toggle works and a signed-out visitor makes no Google/Firebase data request", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto("/");
    const html = page.locator("html");
    const was = await html.evaluate((el) => el.classList.contains("dark"));
    await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
    expect(await html.evaluate((el) => el.classList.contains("dark"))).toBe(!was);
    await page.waitForTimeout(1500);
    expect(requests.filter((u) => /firestore\.googleapis|identitytoolkit|securetoken/.test(u))).toEqual([]);
  });
});
