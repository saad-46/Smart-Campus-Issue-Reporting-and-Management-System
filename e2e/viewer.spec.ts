import { expect, test } from "@playwright/test";
import { ready, roleButton, SEEN_KEY, skipTour, watch } from "./helpers";

const demoToast = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Status messages" });

test.describe("entry and roles", () => {
  test("landing page leads to the Viewer, which shows the demo badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every campus issue.");
    await page.getByRole("main").getByRole("link", { name: "Explore the Platform" }).first().click();
    await expect(page).toHaveURL(/\/viewer$/);
    await expect(page.getByText("Viewer mode").first()).toBeVisible();
  });

  test("the overview hero holds the one role selector and it drives the whole workspace", async ({ page }) => {
    await skipTour(page);
    await page.goto("/viewer");
    await page.evaluate(() => ((window as unknown as { __m: number }).__m = 1));
    const hero = page.locator("main .depth-2").first();
    // One selector, inside the hero card; no strip above it and no suggested-worker card on the page.
    await expect(page.getByRole("group", { name: "Choose a perspective" })).toHaveCount(1);
    await expect(hero.getByRole("group", { name: "Choose a perspective" })).toBeVisible();
    await expect(page.getByText(/Suggested worker/)).toHaveCount(0);
    const nav = page.locator("aside nav");
    for (const [role, first, absent] of [
      ["Student", "My issues", null],
      ["Worker", "My work", "Report an issue"],
      ["Admin", "Overview", null],
      ["Student", "My issues", null],
    ] as const) {
      await roleButton(page, role).click();
      await expect(roleButton(page, role)).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(/\/viewer$/); // the overview stays; only the perspective changes
      await expect(nav.getByRole("link").first()).toContainText(first);
      if (absent) await expect(nav.getByRole("link", { name: absent })).toHaveCount(0);
      await expect(hero).toContainText(role);
    }
    await page.getByRole("link", { name: /^Open the student workspace/ }).click();
    await expect(page).toHaveURL(/\/viewer\/student$/);
    // Elsewhere the selector is in the sidebar, still just one.
    await expect(page.getByRole("group", { name: "Choose a perspective" })).toHaveCount(1);
    await roleButton(page, "Worker").click();
    await expect(page).toHaveURL(/\/viewer\/worker$/);
    await expect(page.locator("main")).not.toContainText("Report an issue");
    expect(await page.evaluate(() => (window as unknown as { __m: number }).__m)).toBe(1);
  });

  test("a worker who opens the report page is sent back to their own workspace", async ({ page }) => {
    await skipTour(page);
    await page.addInitScript(() => sessionStorage.setItem("smart-campus-viewer-role", "worker"));
    await page.goto("/viewer/worker");
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.goto("/viewer/report");
    await expect(page).toHaveURL(/\/viewer\/worker$/, { timeout: 15_000 });
    await expect(page.locator("aside nav").getByRole("link", { name: /report/i })).toHaveCount(0);
  });
  test("a deep link works, survives a refresh and keeps back/forward working", async ({ page }) => {
    await skipTour(page);
    await page.goto("/viewer/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    await page.locator("aside nav").getByRole("link", { name: "Campus map" }).click();
    await expect(page).toHaveURL(/\/viewer\/map$/);
    await page.locator("aside nav").getByRole("link", { name: "Issues" }).click();
    await expect(page).toHaveURL(/\/viewer\/issues$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/viewer\/map$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/viewer\/analytics$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/viewer\/map$/);
    await expect(page.getByRole("heading", { level: 1, name: "Campus map" })).toBeVisible();
  });

  test("an unknown issue shows a friendly message, not a crash", async ({ page }) => {
    await skipTour(page);
    await page.goto("/viewer/issues/SC-0000");
    await expect(page.getByText("That issue isn't in the demo")).toBeVisible();
  });
});

test.describe("guided tour", () => {
  test("opens on a first visit over the page that was requested, then skip is remembered", async ({ page }) => {
    await page.goto("/viewer/admin");
    const tour = page.getByRole("dialog", { name: /Welcome to the UniFix demo/ });
    await expect(tour).toBeVisible();
    await expect(page).toHaveURL(/\/viewer\/admin$/); // not hijacked to /viewer
    await expect(tour.getByText("01 / 24")).toBeVisible();
    await tour.getByRole("button", { name: "Skip" }).click();
    await expect(tour).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), SEEN_KEY)).toBe("1");
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("steps open the right page and highlight a visible element; Back works; Guide restarts", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/viewer/admin");
    const dialog = page.getByRole("dialog", { name: /UniFix demo|workspace|perspectives|dashboard/i }).or(page.locator("[role=dialog][aria-labelledby=tour-title]"));
    const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
    await expect(dialog.first()).toBeVisible();
    // Step 2 highlights the sidebar; step 4 switches to the student dashboard; step 5 opens the report form.
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByText("02 / 24")).toBeVisible();
    await expect(page.locator(".tour-ring")).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/viewer\/student$/);
    await expect(tour.getByText("04 / 24")).toBeVisible();
    await expect(page.locator(".tour-ring")).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/viewer\/report$/);
    await expect(page.locator(".tour-ring")).toBeVisible();
    await tour.getByRole("button", { name: "Back" }).click();
    await expect(tour.getByText("04 / 24")).toBeVisible();
    await tour.getByRole("button", { name: "Close the guide" }).click();
    await expect(tour).toBeHidden();
    await page.getByRole("button", { name: "Open the guided tour" }).click();
    await expect(tour.getByText("01 / 24")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
  });

  test("keyboard: focus starts on Next, Tab stays inside, arrows move, Escape closes and focus returns", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/viewer/admin");
    const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("button", { name: "Next" })).toBeFocused();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await tour.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await tour.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await tour.getByRole("button", { name: "Next" }).focus();
    await page.keyboard.press("Enter");
    await expect(tour.getByText("02 / 24")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(tour.getByText("03 / 24")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(tour.getByText("02 / 24")).toBeVisible();
    // Focus ring is visible on the focused control.
    const outline = await tour.getByRole("button", { name: "Next" }).evaluate((el) => (el as HTMLElement).focus() ?? getComputedStyle(el).outlineStyle);
    expect(outline === undefined || typeof outline === "string").toBe(true);
    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement && document.activeElement !== document.body)).toBe(true);
  });

  test("no step points at something missing (desktop walk of all 24 steps)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/viewer/admin");
    const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
    await expect(tour).toBeVisible();
    for (let step = 1; step <= 24; step++) {
      await expect(tour.getByText(`${String(step).padStart(2, "0")} / 24`)).toBeVisible();
      if (step !== 1 && step !== 24) {
        await expect(page.locator(".tour-ring"), `step ${step} highlights a visible element`).toBeVisible();
        await expect
          .poll(async () => {
            const box = await page.locator(".tour-ring").boundingBox();
            return !!box && box.width > 0 && box.height > 0;
          })
          .toBe(true);
      }
      if (step < 24) await tour.getByRole("button", { name: "Next" }).click();
    }
    await tour.getByRole("button", { name: "Finish" }).click();
    await expect(tour).toBeHidden();
  });

  test("on a phone the tour never highlights an invisible element", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/viewer/admin");
    const tour = page.locator("[role=dialog][aria-labelledby=tour-title]");
    await tour.getByRole("button", { name: "Next" }).click(); // step 2: sidebar, hidden on phones
    await expect(tour.getByText("02 / 24")).toBeVisible();
    await expect(page.locator(".tour-ring")).toHaveCount(0);
    await expect(tour).toBeVisible();
  });
});

test.describe("issues", () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
  });

  test("search and filter the issues table, then open an issue", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/issues");
    const table = page.getByRole("region", { name: "Issues" });
    await expect(table.locator("tbody tr").first()).toBeVisible();
    const all = await page.getByText(/of \d+$/).first().textContent();
    await page.getByRole("searchbox", { name: "Search issues" }).fill("projector");
    await expect(table.locator("tbody tr").first()).toContainText(/projector/i);
    const filtered = await page.getByText(/of \d+$/).first().textContent();
    expect(filtered).not.toBe(all);
    await page.getByLabel("Status", { exact: true }).selectOption("Open");
    for (const row of await table.locator("tbody tr").all()) await expect(row).toContainText("Open");
    await expect(page.getByRole("button", { name: /Remove filter: Status: Open/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByRole("button", { name: /Remove filter/ })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search issues" }).fill("SC-1136");
    await table.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/viewer\/issues\/SC-1136$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AC not cooling");
    await expect(page.getByText("Timeline").first()).toBeVisible();
  });

  test("sorting and pagination change the rows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/issues");
    const first = page.locator("tbody tr").first();
    const before = await first.textContent();
    await page.getByRole("button", { name: /^Priority/ }).click();
    await expect(page.getByRole("columnheader", { name: /Priority/ })).toHaveAttribute("aria-sort", "ascending");
    const next = page.getByRole("button", { name: "Next page" });
    await next.click();
    await expect(page.getByText(/^11–20 of/)).toBeVisible();
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByText(/^1–10 of/)).toBeVisible();
    expect(await first.textContent()).not.toBe(before);
  });

  test("a simulated report appears in the student's issues and the admin's totals", async ({ page }) => {
    await page.goto("/viewer/report");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByText(/at least 5 characters/)).toBeVisible();
    await page.getByLabel("Title").fill("Water leaking near the staircase");
    await page.getByLabel("What is wrong?").fill("Water is dripping from a ceiling pipe and the corridor is slippery.");
    await page.getByLabel("Location", { exact: true }).selectOption({ label: "Block 4" });
    await expect(page.getByTestId("location-detail")).toContainText("Blocks 1 and 4");
    await page.getByLabel("Where exactly? (optional)").fill("second floor, near the staircase");
    await expect(page.getByLabel("aside, Suggestions").or(page.locator("[data-tour=report-ai]"))).toContainText("Plumbing");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toBeVisible();
    await expect(demoToast(page)).toContainText("Demo mode — no real data was modified");
    await roleButton(page, "Admin").click();
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("130");
    await page.locator("aside nav").getByRole("link", { name: "Issues" }).click();
    await expect(page.locator("tbody tr").first()).toContainText("Water leaking near the staircase");
  });

  test("assign a worker as admin, then start and resolve as the worker", async ({ page }) => {
    await page.goto("/viewer/issues/SC-1133");
    await page.getByRole("button", { name: "Assign worker" }).click();
    const dialog = page.getByRole("dialog", { name: "Assign a worker" });
    await expect(dialog.getByRole("radio").first()).toBeChecked();
    await expect(dialog).toContainText("Match");
    await dialog.getByRole("button", { name: "Assign (demo)" }).click();
    await expect(dialog).toBeHidden();
    await expect(demoToast(page)).toContainText("Demo assignment");
    await expect(page.getByRole("button", { name: "Assign worker", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reassign worker" })).toBeVisible();

    await roleButton(page, "Worker").click();
    await page.locator("aside nav").getByRole("link", { name: "My work" }).click();
    const task = page.getByRole("link", { name: /^Flickering tube light in Block 3/ }).first();
    await expect(task).toBeVisible();
    const row = page.locator("li", { has: task });
    await row.getByRole("button", { name: "Start work" }).click();
    await expect(demoToast(page)).toContainText("Work started");
    await row.getByRole("button", { name: "Mark resolved" }).click();
    const resolve = page.getByRole("dialog", { name: "Mark as resolved" });
    await resolve.getByRole("button", { name: "Resolve (demo)" }).click();
    await expect(resolve.getByText(/at least 5 characters/)).toBeVisible();
    await resolve.getByLabel("What was done?").fill("Replaced the loose light fitting.");
    await resolve.getByRole("button", { name: "Resolve (demo)" }).click();
    await expect(resolve).toBeHidden();
    await expect(demoToast(page)).toContainText("Demo resolution");
  });

  test("a demo payment states that no real transaction is created", async ({ page }) => {
    await page.goto("/viewer/finance");
    await page.getByRole("button", { name: "Review" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Review expense claim" });
    await expect(dialog).toContainText("no real transaction will be created");
    await dialog.getByRole("button", { name: /Approve and pay/ }).click();
    await expect(demoToast(page)).toContainText("No real transaction was created");
  });
});

test.describe("analytics, theme and interface", () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
  });

  test("analytics filters change the figures and charts render without dimension warnings", async ({ page }) => {
    const { problems } = watch(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/analytics");
    const reported = page.locator(".glass", { hasText: /^Reported/ }).first();
    await expect(reported).toBeVisible();
    const before = await reported.innerText();
    await page.getByRole("group", { name: "Date range" }).getByRole("button", { name: "7 days" }).click();
    await expect(async () => expect(await reported.innerText()).not.toBe(before)).toPass();
    await page.getByLabel("Category", { exact: true }).selectOption("Electrical");
    await expect(page.getByRole("button", { name: /Remove filter: Electrical/ })).toBeVisible();
    expect(await page.locator(".recharts-wrapper > svg.recharts-surface").count()).toBeGreaterThanOrEqual(4);
    for (const svg of await page.locator(".recharts-wrapper > svg.recharts-surface").all()) {
      const box = await svg.boundingBox();
      expect(box && box.width > 20 && box.height > 20).toBe(true);
    }
    await expect(page.locator("body")).not.toContainText("NaN");
    expect(problems.filter((p) => /width\(|height\(|chart|Recharts/i.test(p))).toEqual([]);
  });

  test("charts keep their size through sidebar, viewport, drawer, theme and navigation changes", async ({ page }) => {
    const { problems } = watch(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/analytics");
    // Charts resize a moment after their container does; the same tolerance (2 px) must be reached, however busy the machine is.
    const widthsFit = () =>
      expect(async () => {
        for (const svg of await page.locator(".recharts-wrapper > svg.recharts-surface").all()) {
          const [sw, cw] = await svg.evaluate((el) => [el.getBoundingClientRect().width, (el.closest(".recharts-responsive-container") as HTMLElement | null)?.getBoundingClientRect().width ?? 0]);
          if (cw > 0) expect(Math.abs(sw - cw)).toBeLessThanOrEqual(2);
        }
      }).toPass({ timeout: 8000 });
    await expect(page.locator(".recharts-wrapper > svg.recharts-surface").first()).toBeVisible();
    await widthsFit();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.waitForTimeout(500);
    await widthsFit();
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await page.waitForTimeout(500);
    await widthsFit();
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(500);
    await widthsFit();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await widthsFit();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(400);
    await widthsFit();
    await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
    await page.waitForTimeout(400);
    await widthsFit();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Issues" }).click();
    await expect(page).toHaveURL(/\/viewer\/issues$/);
    await page.goBack();
    await expect(page.locator(".recharts-wrapper > svg.recharts-surface").first()).toBeVisible();
    await widthsFit();
    expect(problems).toEqual([]);
  });

  test("the theme toggle switches and is remembered", async ({ page }) => {
    await page.goto("/viewer/admin");
    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
    await expect(html).toHaveClass(wasDark ? /^((?!dark).)*$/ : /dark/);
    await page.reload();
    expect(await html.evaluate((el) => el.classList.contains("dark"))).toBe(!wasDark);
  });

  test("the SUES map draws real geometry, and the issue layer and place detail respond", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/map");
    const map = page.getByRole("group", { name: /^SUES campus map/ });
    await expect(map).toBeVisible();
    await expect(page.getByText("© OpenStreetMap contributors").first()).toBeVisible();
    await expect(page.locator("main")).toContainText("none of these issues happened");
    // Real footprints, never a guessed building name.
    expect(await map.locator("[data-layer=footprints] path, [data-layer=footprints] polygon").count()).toBe(6);
    expect(await map.locator("[data-place]").count()).toBe(12);
    // Places that are not part of the campus dataset are never drawn.
    await expect(map).not.toContainText(/Gymnasium|SBI|State Bank/);
    await expect(map).not.toContainText(/Computer Science|Block A|Hostel|Canteen/);

    await page.getByRole("radio", { name: /SLA hotspots/ }).check();
    await expect(map).toHaveAttribute("aria-label", /deadline alert/);
    const blocks = map.getByRole("button", { name: /^Block 3/ });
    await blocks.press("Enter");
    await expect(blocks).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Block 3" })).toBeVisible();
    const detail = page.locator(".glass", { has: page.getByRole("heading", { name: "Block 3" }) }).first();
    await expect(detail).toContainText("Approximate position");
    await expect(detail).toContainText("17.4281, 78.4419");
  });

  test("map feature layers, search and filters change what is drawn", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/viewer/map");
    const map = page.getByRole("group", { name: /^SUES campus map/ });
    await expect(map.locator("[data-layer=roads]")).toHaveCount(1);
    await page.getByRole("checkbox", { name: "Roads and paths" }).uncheck();
    await expect(map.locator("[data-layer=roads]")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Building footprints" }).uncheck();
    await expect(map.locator("[data-layer=footprints]")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Campus places" }).uncheck();
    await expect(map.locator("[data-place]")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Campus places" }).check();
    await expect(map.locator("[data-place]")).toHaveCount(12);

    const search = page.getByRole("searchbox", { name: "Search the map" }).or(page.getByLabel("Search the map"));
    await search.fill("seminar");
    await expect(page.locator("main")).toContainText("1 place highlighted.");
    await search.fill("library");
    await expect(page.locator("main")).toContainText("S.M. Nizamuddin Central Library: on campus, but its position isn't known");
    await search.fill("12 jubilee hills road");
    await expect(page.locator("main")).toContainText("No mapped place matches");
    await search.fill("");
    await page.getByLabel("Verification", { exact: true }).selectOption({ label: "Approximate position" });
    await expect(page.locator("main")).toContainText("12 places highlighted.");
    await expect(page.getByRole("button", { name: /Remove filter: Approximate position/ })).toBeVisible();
  });

  test("an old QR-style link opens the normal report form and is otherwise ignored", async ({ page }) => {
    for (const query of ["mjcet-seminar-hall", "block-a", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", ""]) {
      await page.goto(`/viewer/report?location=${query}`);
      await expect(page.getByRole("heading", { level: 1, name: "Report an issue" })).toBeVisible();
      await expect(page.getByLabel("Location", { exact: true })).toHaveValue("");
      await expect(page.getByText(/QR/)).toHaveCount(0);
    }
  });
  test("a place can be chosen on the map in the report form", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/viewer/report");
    await page.getByRole("button", { name: "Pick on the map" }).click();
    await page.getByRole("button", { name: /^Ghulam Ahmed Hall/ }).press("Enter");
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("mjcet-ghulam-ahmed-hall");
    await expect(page.getByTestId("location-detail")).toContainText("Approximate position");
  });

  test("search palette (Ctrl K), notifications and toasts", async ({ page }) => {
    await page.goto("/viewer/admin");
    await ready(page); // the shortcut is registered once the page has hydrated
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search the demo" });
    await expect(palette.getByRole("combobox")).toBeFocused();
    await palette.getByRole("combobox").fill("projector");
    await expect(palette.getByRole("option").first()).toContainText(/projector/i);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/viewer\/issues\/SC-/);
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    const bell = page.getByRole("button", { name: /^Notifications, \d+ unread/ });
    await bell.click();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(demoToast(page)).toContainText("Notifications marked as read");
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  });

  test("a location opens its details, with no QR code, and focus returns when it closes", async ({ page }) => {
    await page.goto("/viewer/locations");
    const opener = page.getByRole("button", { name: /Seminar Hall, Block 4/ });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: /Seminar Hall, Block 4/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(/QR/);
    await expect(dialog.getByRole("img")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
  test("reduced motion shows KPI numbers immediately", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/viewer/admin");
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("129");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  });

  test("mobile navigation drawer opens, traps focus, closes and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/viewer/issues");
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: "Notifications" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.click();
    await drawer.getByRole("link", { name: "Timeline" }).click();
    await expect(page).toHaveURL(/\/viewer\/timeline$/);
    await expect(drawer).toBeHidden();
  });
});

test.describe("isolation", () => {
  test("browsing every Viewer route and acting makes no request outside the site and none to Firebase", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const { requests, problems } = watch(page);
    await skipTour(page);
    await page.goto("/viewer");
    for (const href of ["/viewer/student", "/viewer/report", "/viewer/issues", "/viewer/worker", "/viewer/admin", "/viewer/analytics", "/viewer/map", "/viewer/workers", "/viewer/finance", "/viewer/transactions", "/viewer/locations", "/viewer/notifications", "/viewer/search", "/viewer/timeline", "/viewer/settings", "/viewer/how-it-works"]) {
      await page.goto(href);
      await ready(page);
    }
    await page.goto("/viewer/finance");
    await page.getByRole("button", { name: "Review" }).first().click();
    await page.getByRole("button", { name: /Approve and pay/ }).click();
    const origin = new URL(baseURL!).origin;
    const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:"));
    expect(foreign).toEqual([]);
    expect(requests.filter((u) => /firestore|firebase|identitytoolkit|securetoken|googleapis|localhost:(8080|9099)/i.test(u))).toEqual([]);
    expect(problems).toEqual([]);
    // Nothing the Viewer does is written to the browser except the preferences.
    const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].sort());
    for (const key of stored) expect(["smart-campus-viewer-guide-seen", "smart-campus-viewer-role", "theme", "smart-campus-sidebar-collapsed", "qa"]).toContain(key);
    expect(await page.evaluate(async () => (await indexedDB.databases?.())?.map((d) => d.name) ?? [])).toEqual([]);
  });

  test("signed-out visitors are redirected away from protected pages", async ({ page }) => {
    for (const path of ["/dashboard", "/worker", "/admin", "/admin/finance", "/issues/abc123"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}`), { timeout: 15_000 });
    }
  });
});
