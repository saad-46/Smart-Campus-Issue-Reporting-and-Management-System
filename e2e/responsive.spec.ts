import { expect, Page, test } from "@playwright/test";
import { ready, skipTour, VIEWER_ROUTES, VIEWPORTS, watch } from "./helpers";

// Every Viewer route (plus the public pages) at ten viewport sizes in both themes.

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* blocked */
    }
  }, theme);
}

/** Elements that stick out past the viewport and are not inside a scroll container. */
async function stickingOut(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out: string[] = [];
    for (const e of document.querySelectorAll("main *, header *, aside *")) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
      if (getComputedStyle(e).position === "fixed") continue;
      let p = e.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped) out.push(`${e.tagName}.${String(e.className).slice(0, 40)}@${Math.round(r.right)}`);
    }
    return out.slice(0, 3);
  });
}

for (const theme of ["dark", "light"] as const) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`${theme} ${width}x${height}`, () => {
      test.use({ viewport: { width, height } });

      test("landing, login and register fit", async ({ page }) => {
        await setTheme(page, theme);
        for (const path of ["/", "/login", "/register"]) {
          await page.goto(path);
          await expect(page.locator("h1").first()).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows`).toBe(true);
          expect(await stickingOut(page), `${path} has clipped elements`).toEqual([]);
        }
      });

      test("every Viewer route fits and logs nothing", async ({ page }) => {
        test.setTimeout(120_000);
        await skipTour(page);
        await setTheme(page, theme);
        const { problems } = watch(page);
        for (const path of VIEWER_ROUTES) {
          await page.goto(path);
          await ready(page);
          await page.waitForTimeout(250);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows`).toBe(true);
          expect(await stickingOut(page), `${path} has clipped elements`).toEqual([]);
          const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
          expect(dark).toBe(theme === "dark");
        }
        expect(problems).toEqual([]);
      });

      test("dialogs and the tour stay inside the viewport", async ({ page }) => {
        await setTheme(page, theme);
        await page.goto("/viewer/finance");
        const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
        await expect(tour).toBeVisible();
        // Dialogs slide in; measure once the entrance animation has finished.
        const fits = async (loc: ReturnType<Page["locator"]>) => {
          await expect
            .poll(async () => {
              const b = await loc.boundingBox();
              return !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1;
            })
            .toBe(true);
        };
        await fits(tour);
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Review" }).first().click();
        await fits(page.getByRole("dialog", { name: "Review expense claim" }));
      });
    });
  }
}
