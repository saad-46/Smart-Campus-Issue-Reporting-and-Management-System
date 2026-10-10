import { expect, Page, test } from "@playwright/test";

// Signed-in workflows against the LOCAL Firebase emulators with seeded test
// accounts. These never run against production:
//   - skipped unless E2E_EMULATOR=1, and
//   - refuses any base URL that is not localhost.
//
// Setup (see docs/MANUAL_VERIFICATION.md, "Emulator run"):
//   1. npx firebase-tools emulators:start --only auth,firestore --project demo-unifix
//   2. npm run seed:emulator -- --issues=60 --reset
//   3. a .env.development.local that points the app at the emulators, then npx next dev -p 3230
//   4. E2E_EMULATOR=1 E2E_BASE_URL=http://localhost:3230 npx playwright test e2e/signed-in.emulator.spec.ts

const RUN = process.env.E2E_EMULATOR === "1";
const PASSWORD = process.env.SEED_PASSWORD || "emulator-only-demo"; // the documented emulator-only seed password
const STAMP = String(Date.now()).slice(-6);
const TITLE = `TEST lifecycle ${STAMP}: ceiling fan not working`;
const QR_TITLE = `TEST QR ${STAMP}: tap dripping`;
const RETRY_TITLE = `TEST retry ${STAMP}: window latch broken`;

test.describe.configure({ mode: "serial" });
test.skip(!RUN, "Emulator-only: set E2E_EMULATOR=1 and E2E_BASE_URL=http://localhost:<port>");
test.setTimeout(120_000);

test.beforeAll(({}, info) => {
  const base = String(info.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "");
  if (RUN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) throw new Error(`Refusing to run signed-in tests against ${base}`);
});

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").first().fill(email);
  await page.getByLabel("Password").first().fill(PASSWORD);
  await page.getByRole("button", { name: /^(Sign in|Log in)$/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Everything the signed-in app contacts must be the app itself or the local emulators. */
function guardNetwork(page: Page) {
  const bad: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/^(data|blob):/.test(u)) return;
    const host = new URL(u).host;
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) bad.push(u);
  });
  return bad;
}

const hasConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

let issuePath = "";

test("student: signs in, reports at a campus place, sees it, and is kept out of staff pages", async ({ page }) => {
  const outside = guardNetwork(page);
  const errors = hasConsoleErrors(page);
  await signIn(page, "student1@unifix.test");
  await expect(page).toHaveURL(/\/dashboard/);
  for (const path of ["/admin", "/admin/finance", "/admin/workers", "/worker"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  }

  await page.goto("/dashboard/report");
  await page.getByLabel("Campus place (optional)").selectOption({ label: "Block 4" });
  await expect(page.getByPlaceholder(/e\.g\. Block 4/)).toHaveValue("Block 4");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("Describe the problem").fill("The ceiling fan makes a loud noise and stops after a few minutes.");
  await page.getByPlaceholder(/e\.g\. Block 4/).fill("Block 4, second floor, near the staircase");
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await page.waitForURL(/\/issues\/[A-Za-z0-9]+$/, { timeout: 60_000 });
  issuePath = new URL(page.url()).pathname;
  expect(issuePath).not.toMatch(/\/issues\/(SC-\d+|demo-)/); // a real Firestore id, never a demo id
  await expect(page.locator("h1")).toContainText(TITLE);
  await expect(page.locator("main")).toContainText("Block 4, second floor, near the staircase");
  await expect(page.locator("main")).toContainText("Open");

  // Own report in the list, and the discussion works for its reporter.
  await page.goto("/dashboard");
  await expect(page.getByText(TITLE)).toBeVisible({ timeout: 30_000 });
  await page.goto(issuePath);
  await page.getByPlaceholder("Write a message…").fill("TEST message from the reporter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("TEST message from the reporter");

  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
  await signOut(page);
  await page.goto(issuePath);
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});

test("another student cannot read the discussion of that issue", async ({ page }) => {
  test.skip(!issuePath, "needs the issue from the previous test");
  await signIn(page, "student2@unifix.test");
  await page.goto(issuePath);
  await expect(page.getByRole("region", { name: "Discussion" })).toContainText("private to the person who reported");
  await expect(page.getByRole("region", { name: "Discussion" }).getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("log", { name: "Messages" })).toHaveCount(0);
});

test("admin: assigns a worker, escalates, and both persist across a reload", async ({ page }) => {
  test.skip(!issuePath, "needs the issue from the first test");
  const errors = hasConsoleErrors(page);
  await signIn(page, "admin@unifix.test");
  await page.goto(issuePath);
  const manage = page.getByRole("region", { name: "Manage issue" });
  await manage.getByRole("button", { name: "Assign" }).click();
  const dialog = page.getByRole("dialog", { name: "Assign issue" });
  await dialog.locator("li", { hasText: "Demo Worker 1" }).getByRole("button", { name: /^Assign/ }).click();
  await expect(manage).toContainText("Demo Worker 1");
  await manage.getByRole("button", { name: "Escalate" }).click();
  await expect(manage.getByRole("button", { name: "Clear escalation" })).toBeVisible();
  await page.reload();
  const again = page.getByRole("region", { name: "Manage issue" });
  await expect(again).toContainText("Demo Worker 1");
  await expect(again.getByRole("button", { name: "Clear escalation" })).toBeVisible();

  // The same place is counted on the real campus map.
  await page.goto("/admin/map");
  const marker = page.getByRole("group", { name: /^SUES campus map/ }).locator("[data-place=blocks-3-4]");
  await expect(marker).toHaveAttribute("aria-label", /: [1-9]/, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("worker: starts, resolves with an expense claim; a second action on the finished task is impossible", async ({ page }) => {
  test.skip(!issuePath, "needs the issue from the first test");
  await signIn(page, "worker1@unifix.test");
  await page.goto("/worker");
  const start = page.getByRole("button", { name: new RegExp(`Start.*${STAMP}`) });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Suggested checks").first()).toBeVisible();
  await start.click();
  const resolve = page.getByRole("button", { name: new RegExp(`Resolve.*${STAMP}`) });
  await expect(resolve).toBeVisible();
  await resolve.click();
  const dialog = page.getByRole("dialog", { name: "Resolve task" });
  await dialog.getByLabel("Add a claim").check();
  await dialog.getByLabel("Amount").fill("0");
  await dialog.getByRole("button", { name: "Resolve and submit claim" }).click();
  await expect(dialog).toContainText(/greater than 0|valid amount/i);
  await dialog.getByLabel("Amount").fill("120.50");
  await dialog.getByLabel("What was it spent on?").fill("TEST fan capacitor");
  await dialog.getByRole("button", { name: "Resolve and submit claim" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: new RegExp(`Resolve.*${STAMP}`) })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(`Start.*${STAMP}`) })).toHaveCount(0);
});

test("admin: pays the claim exactly once; a worker cannot reach finance; the student is notified", async ({ page }) => {
  test.skip(!issuePath, "needs the issue from the first test");
  await signIn(page, "admin@unifix.test");
  await page.goto("/admin/finance");
  const review = page.getByRole("button", { name: new RegExp(`Review claim for.*${STAMP}`) });
  await expect(review).toBeVisible({ timeout: 30_000 });
  await review.click();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(review).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(/Recent payouts/);
  // Paid once: the claim no longer offers a review, even after a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`Review claim for.*${STAMP}`) })).toHaveCount(0);
  await signOut(page);

  await signIn(page, "worker1@unifix.test");
  await page.goto("/admin/finance");
  await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 });
  await signOut(page);

  await signIn(page, "student1@unifix.test");
  await page.goto(issuePath);
  await expect(page.locator("main")).toContainText("Resolved", { timeout: 30_000 });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText(TITLE).first()).toBeVisible();
});

test("QR: a seeded location fills the form and the report keeps it; unknown, malformed and tampered ids are refused", async ({ page }) => {
  await signIn(page, "student2@unifix.test");
  await page.goto("/dashboard/report?location=mjcet-seminar-hall");
  await expect(page.getByText("From the QR code you scanned")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main")).toContainText("Seminar Hall, Block 4");
  await page.getByLabel("Title").fill(QR_TITLE);
  await page.getByLabel("Describe the problem").fill("The projector in the seminar hall will not power on.");
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await page.waitForURL(/\/issues\/[A-Za-z0-9]+$/, { timeout: 60_000 });
  await expect(page.locator("main")).toContainText("Seminar Hall, Block 4");

  for (const bad of ["no-such-place", "BLOCK-4", "mjcet-block-4%20", "..%2F..%2Fadmin", "%3Cscript%3Ealert(1)%3C%2Fscript%3E", "a".repeat(80), "mjcet-seminar-hall&location=admin", ""]) {
    await page.goto(`/dashboard/report?location=${bad}`);
    if (bad === "") {
      await expect(page.getByText("QR location not recognised")).toHaveCount(0);
      continue;
    }
    // Either the whole parameter is refused, or (for an appended parameter) only the known id is used; never an unknown one.
    if (bad.startsWith("mjcet-seminar-hall&")) {
      await expect(page.getByText("From the QR code you scanned")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("main")).not.toContainText("admin");
    } else {
      await expect(page.getByText("QR location not recognised")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("From the QR code you scanned")).toHaveCount(0);
    }
  }
});

test("submission failure shows no success, and a retry succeeds without a duplicate", async ({ page, context }) => {
  await signIn(page, "student3@unifix.test");
  await page.goto("/dashboard/report");
  await page.getByLabel("Title").fill(RETRY_TITLE);
  await page.getByLabel("Describe the problem").fill("The latch on the window will not stay closed.");
  await page.getByPlaceholder(/e\.g\. Block 4/).fill("Block 2, room near the lift");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await expect(page.getByText(/couldn't submit|unable to submit|offline|connection/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Issue submitted")).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard\/report/);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await page.waitForURL(/\/issues\/[A-Za-z0-9]+$/, { timeout: 60_000 });
  await page.goto("/dashboard");
  await expect(page.getByText(RETRY_TITLE)).toHaveCount(1, { timeout: 30_000 });
});

test("Explore while signed in: only demo data, no Firebase request, and nothing reaches the real budget", async ({ page }) => {
  await signIn(page, "admin@unifix.test");
  await page.goto("/admin/finance");
  const budgetBefore = await page.locator("main").innerText();
  await page.addInitScript(() => localStorage.setItem("smart-campus-viewer-guide-seen", "1"));
  // Count only requests made BY an Explore page: the signed-in page we just left may still be closing its own listener.
  const firebaseRequests: string[] = [];
  page.on("request", (r) => {
    let from = "";
    try {
      from = r.frame().url();
    } catch {
      /* navigation in progress */
    }
    if (from.includes("/viewer") && /:(8080|9099)|googleapis|firebase/i.test(r.url())) firebaseRequests.push(r.url());
  });
  await page.goto("/viewer/issues", { waitUntil: "load" });
  await page.locator("tbody tr").first().waitFor({ timeout: 60_000 });
  const ids = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => r.textContent?.match(/SC-\d+/)?.[0] ?? "REAL"));
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.every((i) => /^SC-\d+$/.test(i))).toBe(true);
  await expect(page.locator("main")).not.toContainText("TEST lifecycle");
  await page.goto("/viewer/finance", { waitUntil: "load" });
  await page.getByRole("button", { name: "Add funds" }).click();
  await page.getByRole("dialog", { name: "Add funds" }).getByLabel("Amount").fill("12345");
  await page.getByRole("button", { name: "Add funds (demo)" }).click();
  await page.waitForTimeout(1500);
  expect(firebaseRequests).toEqual([]);
  await page.goto("/admin/finance");
  await page.getByText("Budget used").first().waitFor({ timeout: 60_000 });
  expect(await page.locator("main").innerText()).not.toContain("12,345");
  expect(budgetBefore.length).toBeGreaterThan(0);

  // A fresh tab of the same signed-in browser: every request it makes is checked, with no frame filtering.
  const fresh = await page.context().newPage();
  const all: string[] = [];
  fresh.on("request", (r) => all.push(r.url()));
  await fresh.goto("/viewer/admin", { waitUntil: "load" });
  await fresh.locator("[data-tour=admin-kpis]").waitFor({ timeout: 60_000 });
  await fresh.goto("/viewer/map", { waitUntil: "load" });
  await fresh.waitForTimeout(2000);
  expect(all.filter((u) => /:(8080|9099)|googleapis|firebase|identitytoolkit|securetoken/i.test(u))).toEqual([]);
});
