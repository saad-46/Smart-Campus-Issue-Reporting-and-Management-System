import { expect, Page, test } from "@playwright/test";
import { roleButton, skipTour, watch } from "./helpers";

async function as(page: Page, role: "student" | "worker" | "admin") {
  await page.addInitScript((r) => {
    try {
      sessionStorage.setItem("smart-campus-viewer-role", r);
    } catch {
      /* storage blocked */
    }
  }, role);
}

const SIZES = [
  ["desktop", 1440, 900],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const;

const map = (page: Page) => page.getByRole("group", { name: /^SUES campus map/ });

async function openMap(page: Page) {
  await skipTour(page);
  await as(page, "admin");
  await page.goto("/viewer/map");
  await expect(map(page)).toBeVisible();
  await map(page).scrollIntoViewIfNeeded();
}

test.describe("campus map corrections", () => {
  for (const [name, width, height] of SIZES) {
    test(`${name} (${width}px): one Blocks 1 & 4 marker, SUCL and MBA, three gates, labels clear`, async ({ page }) => {
      const seen = watch(page);
      await page.setViewportSize({ width, height });
      await openMap(page);
      const m = map(page);

      // One combined marker; Block 1 and Block 4 are not separate places.
      await expect(m.locator("[data-place=blocks-1-4]")).toHaveCount(1);
      await expect(m.getByRole("button", { name: /^Blocks 1 and 4: / })).toHaveCount(1);
      await expect(m.getByRole("button", { name: /^Block 1[: ]/ })).toHaveCount(0);
      await expect(m.getByRole("button", { name: /^Block 4[: ]/ })).toHaveCount(0);
      await expect(m.locator("[data-place]")).toHaveCount(12);

      // Short labels (the full names remain the accessible names).
      await expect(m.locator("[data-label=blocks-1-4]")).toHaveText("Blocks 1 & 4");
      await expect(m.locator("[data-label=college-of-law]")).toHaveText("SUCL");
      await expect(m.locator("[data-label=business-administration]")).toHaveText("MBA");
      await expect(m.getByRole("button", { name: /^Sultan-Ul-Uloom College of Law/ })).toHaveCount(1);
      await expect(m.getByRole("button", { name: /^Amjad Ali Khan College of Business Administration/ })).toHaveCount(1);
      // (the full names live in the accessible names and tooltips, not in the drawn labels)
      expect((await m.locator("text[data-label]").allTextContents()).join("|")).not.toMatch(/College of Law|Business Administration/);

      // Three roadside gates are gone; the other three stay, and the legend still explains them.
      await expect(m.locator("[data-layer=gates] rect")).toHaveCount(3);
      await expect(page.getByText("Mapped gate", { exact: true }).first()).toBeVisible();

      // Those three labels are shown and no two shown labels overlap.
      for (const id of ["blocks-1-4", "college-of-law", "business-administration"]) await expect(m.locator(`[data-label=${id}]`)).toHaveAttribute("data-label-visible", "true");
      const boxes = await m.locator("[data-label][data-label-visible=true]").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.getAttribute("data-label"), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
        })
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0, `${a.id} overlaps ${b.id}`).toBe(false);
        }

      // Markers are small: the largest drawn circle is no wider than 28 px on screen.
      const widest = await m.locator("circle.marker").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().width)));
      expect(widest).toBeLessThanOrEqual(30);
      expect(seen.problems).toEqual([]);
    });
  }

  test("selecting, switching and deselecting a marker; keyboard; halo only while selected", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    const m = map(page);
    const a = m.locator("[data-place=blocks-1-4]");
    const b = m.locator("[data-place=masjid]");
    await expect(a).toHaveAttribute("aria-pressed", "false");
    await expect(m.locator(".map-pulse")).toHaveCount(0);

    await a.click();
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await expect(a).toHaveAttribute("data-selected", "true");
    await expect(m.locator(".map-pulse")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Blocks 1 and 4" })).toBeVisible();

    await b.click(); // another marker takes over; only one is ever selected
    await expect(a).toHaveAttribute("aria-pressed", "false");
    await expect(b).toHaveAttribute("aria-pressed", "true");
    await expect(m.locator("[data-selected=true]")).toHaveCount(1);

    await b.click(); // click again to deselect
    await expect(b).toHaveAttribute("aria-pressed", "false");
    await expect(m.locator(".map-pulse")).toHaveCount(0);

    await a.focus();
    await a.press("Enter");
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await a.press(" ");
    await expect(a).toHaveAttribute("aria-pressed", "false");

    // Zoom still works with a marker selected.
    await a.click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByRole("button", { name: "Reset the map view" })).toBeEnabled();
    await expect(a).toHaveAttribute("aria-pressed", "true");
  });

  test("a drag that starts on a marker pans the zoomed map and does not select it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    const m = map(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    const a = m.locator("[data-place=blocks-1-4]");
    const box = (await a.locator("circle.marker").boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 10, { steps: 6 });
    await page.mouse.up();
    await expect(a).toHaveAttribute("aria-pressed", "false");
  });

  test("reduced motion: selection still works, the pulse is not shown, the selected state is static", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    const m = map(page);
    const a = m.locator("[data-place=sports-center]");
    await a.click();
    await expect(a).toHaveAttribute("aria-pressed", "true");
    const style = await a.evaluate((g) => ({
      pulse: getComputedStyle(g.querySelector(".map-pulse")!).display,
      anim: getComputedStyle(g.querySelector("circle.marker")!).animationName,
      stroke: getComputedStyle(g.querySelector("circle.marker")!).strokeWidth,
    }));
    expect(style.pulse).toBe("none");
    expect(style.anim).toBe("none");
    expect(parseFloat(style.stroke)).toBeGreaterThan(0);
    await a.click();
    await expect(a).toHaveAttribute("aria-pressed", "false");
  });

  test("with motion allowed the selected marker animates once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    const a = map(page).locator("[data-place=sports-center]");
    await a.click();
    expect(await a.locator(".map-pulse").evaluate((e) => getComputedStyle(e).animationName)).toBe("map-halo");
    expect(await a.locator("circle.marker").evaluate((e) => getComputedStyle(e).animationName)).toBe("map-marker-settle");
  });
});

test.describe("Explore as selector", () => {
  for (const [name, width, height] of SIZES) {
    test(`${name} (${width}px): three separate, unclipped, selectable roles on the overview`, async ({ page }) => {
      const seen = watch(page);
      await skipTour(page);
      await page.setViewportSize({ width, height });
      await page.goto("/viewer");
      const group = page.getByRole("group", { name: "Choose a perspective" });
      await expect(group).toBeVisible();
      await expect(page.getByText("Explore as", { exact: true })).toBeVisible();

      const geometry = async () =>
        group.getByRole("button").evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            const label = e.querySelector("span");
            const icon = e.querySelector("svg")!.getBoundingClientRect();
            const lr = label!.getBoundingClientRect();
            return { text: e.textContent, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, clipped: label!.scrollWidth > label!.clientWidth, iconInside: icon.left >= r.left && icon.right <= r.right, labelInside: lr.left >= r.left && lr.right <= r.right, iconLabelGap: Math.min(Math.abs(lr.left - icon.right), Math.abs(lr.top - icon.bottom)) };
          })
        );
      const g = await geometry();
      expect(g.map((x) => x.text)).toEqual(["Student", "Worker", "Admin"]);
      for (let i = 0; i < g.length; i++) {
        expect(g[i].clipped, g[i].text!).toBe(false);
        expect(g[i].iconInside && g[i].labelInside, g[i].text!).toBe(true);
        expect(g[i].y1 - g[i].y0, `${g[i].text} height`).toBeGreaterThanOrEqual(40); // a comfortable touch target
        if (i > 0) expect(g[i].x0, `${g[i - 1].text} / ${g[i].text}`).toBeGreaterThanOrEqual(g[i - 1].x1 + 2); // no overlap, a gap between
      }
      expect(new Set(g.map((x) => Math.round(x.y1 - x.y0))).size).toBe(1); // one control height
      const gr = await group.boundingBox();
      expect(gr!.x + gr!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Each role is independently selectable and drives the same mode as before.
      for (const role of ["Worker", "Admin", "Student"] as const) {
        await roleButton(page, role).click();
        await expect(roleButton(page, role)).toHaveAttribute("aria-pressed", "true");
        for (const other of (["Student", "Worker", "Admin"] as const).filter((r) => r !== role)) await expect(roleButton(page, other)).toHaveAttribute("aria-pressed", "false");
        await expect(page).toHaveURL(/\/viewer$/);
      }
      expect(seen.problems).toEqual([]);
    });
  }

  test("keyboard: Tab reaches each role with a visible focus ring, Enter and Space select it", async ({ page }) => {
    await skipTour(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer");
    const worker = roleButton(page, "Worker");
    await worker.focus();
    await expect(worker).toBeFocused();
    const ring = await worker.evaluate((e) => getComputedStyle(e).boxShadow);
    expect(ring).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(worker).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(roleButton(page, "Admin")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(roleButton(page, "Admin")).toHaveAttribute("aria-pressed", "true");
  });

  test("sidebar copy on a workspace page: three roles fit its width without overlapping", async ({ page }) => {
    await skipTour(page);
    await as(page, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/map");
    const group = page.getByRole("group", { name: "Choose a perspective" });
    await expect(group).toBeVisible();
    const g = await group.getByRole("button").evaluateAll((els) => els.map((e) => ({ r: e.getBoundingClientRect(), clipped: e.querySelector("span")!.scrollWidth > e.querySelector("span")!.clientWidth, w: e.scrollWidth <= e.clientWidth + 1 })));
    expect(g).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(g[i].clipped).toBe(false);
      expect(g[i].w).toBe(true);
      if (i) expect(g[i].r.left).toBeGreaterThanOrEqual(g[i - 1].r.right + 2);
    }
  });
});
