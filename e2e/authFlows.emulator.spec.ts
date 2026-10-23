import { expect, Page, test } from "@playwright/test";

// Sign-in by role, student registration and profile, sign-out, and the Activity
// pages, against the LOCAL emulators (same setup and guards as
// signed-in.emulator.spec.ts). Never runs against production.

const RUN = process.env.E2E_EMULATOR === "1";
const PASSWORD = process.env.SEED_PASSWORD || "emulator-only-demo";
const STAMP = String(Date.now()).slice(-6);

test.describe.configure({ mode: "serial" });
test.skip(!RUN, "Emulator-only: set E2E_EMULATOR=1 and E2E_BASE_URL=http://localhost:<port>");
test.setTimeout(120_000);

test.beforeAll(({}, info) => {
  const base = String(info.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "");
  if (RUN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) throw new Error(`Refusing to run signed-in tests against ${base}`);
});

async function signInAs(page: Page, role: "Student" | "Worker" | "Admin", email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: `Sign in as ${role}` }).click();
  await expect(page.getByRole("heading", { name: `Sign in as ${role}` })).toBeVisible();
  await page.getByLabel("Email").first().fill(email);
  await page.getByLabel("Password").first().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}

test("the home page leads to a three-way role choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  const links = page.getByRole("list", { name: "Sign in as" }).getByRole("link");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toContainText("Sign in as Student");
  await expect(links.nth(1)).toContainText("Sign in as Worker");
  await expect(links.nth(2)).toContainText("Sign in as Admin");
  // Keyboard: the first choice is reachable and activates with Enter.
  await links.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login\?role=student$/);
});

test("choosing a role proves nothing: the account must hold it, otherwise it is signed out", async ({ page }) => {
  // A student cannot enter as Worker or Admin.
  for (const role of ["Worker", "Admin"] as const) {
    await signInAs(page, role, "student1@unifix.test");
    await expect(page.getByText(role === "Worker" ? "doesn't have worker access" : "isn't an administrator account")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
    // They really were signed out again.
    await page.goto(role === "Worker" ? "/worker" : "/admin");
    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 15_000 });
  }
  // A worker cannot enter as Admin; an admin can.
  await signInAs(page, "Admin", "worker1@unifix.test");
  await expect(page.getByText("isn't an administrator account")).toBeVisible({ timeout: 30_000 });
  await signInAs(page, "Admin", "admin@unifix.test");
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  await signOut(page);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  // The right role signs in to the right dashboard.
  await signInAs(page, "Worker", "worker1@unifix.test");
  await page.waitForURL(/\/worker$/, { timeout: 60_000 });
  await signOut(page);
  await page.waitForURL((u) => u.pathname === "/");
  await signInAs(page, "Student", "student1@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
});

test("sign out lands on the home page, and Back cannot reopen the dashboard", async ({ page }) => {
  await signInAs(page, "Student", "student2@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "My issues" })).toBeVisible();
  const account = page.getByRole("button", { name: /^Account menu for/ });
  const firstAccount = await account.getAttribute("aria-label");
  expect(firstAccount).toBeTruthy();
  await signOut(page);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every campus issue.");
  await page.goBack();
  // Back may land on the sign-in form it came from, or send a protected page to /login: never on the dashboard.
  await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "My issues" })).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 15_000 });
  // A different person in the same browser sees only their own account.
  await signInAs(page, "Student", "student3@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(account).toBeVisible();
  expect(await account.getAttribute("aria-label")).not.toBe(firstAccount);
});

test("student registration needs college, roll number, year and branch, then shows them", async ({ page }) => {
  const email = `reg-${STAMP}@unifix.test`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill(`TEST Student ${STAMP}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/-digit PIN/).fill("123456");
  // Submitting with the student fields empty explains each one and creates nothing.
  await page.getByRole("button", { name: "Create account" }).click();
  for (const text of ["Enter your college or institution name.", "Enter your roll number.", "Choose your academic year.", "Enter your branch or department."]) {
    await expect(page.getByText(text)).toBeVisible();
  }
  await expect(page).toHaveURL(/\/register$/);

  await page.getByLabel("College / institution").fill("Sultan-ul-Uloom College of Engineering");
  await page.getByLabel("Roll number").fill("1604-21-737-042");
  await page.getByLabel("Academic year").selectOption("3rd year");
  await page.getByLabel("Branch / department").fill("Computer Science");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });

  const card = page.getByLabel("Student details", { exact: true }).first();
  await expect(card).toContainText(`TEST Student ${STAMP}`, { timeout: 30_000 });
  await expect(card).toContainText("Sultan-ul-Uloom College of Engineering");
  await expect(card).toContainText("Roll no. 1604-21-737-042");
  await expect(card).toContainText("3rd year");
  await expect(card).toContainText("Computer Science");

  // Edit, persist across a reload.
  await card.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Student details" });
  await dialog.getByLabel("Branch / department").fill("Civil Engineering");
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel("Student details", { exact: true }).first()).toContainText("Civil Engineering", { timeout: 30_000 });
});

test("a worker request does not ask for student details", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("radio", { name: /Resolve issues/ }).click();
  await expect(page.getByLabel("College / institution")).toHaveCount(0);
  await page.getByRole("radio", { name: /Report issues/ }).click();
  await expect(page.getByLabel("College / institution")).toBeVisible();
});

test("an existing account without details is asked to add them, and cannot save a bad value", async ({ page }) => {
  await signInAs(page, "Student", "student4@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const card = page.getByLabel("Student details", { exact: true }).first();
  await expect(card).toContainText("Add your student details", { timeout: 30_000 });
  await card.getByRole("button", { name: "Add details" }).click();
  const dialog = page.getByRole("dialog", { name: "Student details" });
  await dialog.getByLabel("College / institution").fill("Test College");
  await dialog.getByLabel("Roll number").fill("<b>1</b>");
  await dialog.getByLabel("Academic year").selectOption("2nd year");
  await dialog.getByLabel("Branch / department").fill("Mechanical");
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toContainText("letters, numbers");
  await dialog.getByLabel("Roll number").fill("ME-204");
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(card).toContainText("Roll no. ME-204");
});

test("every role has Activity: Notifications, Search and Timeline, and no How it works", async ({ page }) => {
  const accounts: [string, string, string][] = [
    ["Student", "student1@unifix.test", "/dashboard"],
    ["Worker", "worker1@unifix.test", "/worker"],
    ["Admin", "admin@unifix.test", "/admin"],
  ];
  for (const [role, email, home] of accounts) {
    await signInAs(page, role as "Student", email);
    await page.waitForURL((u) => u.pathname === home, { timeout: 60_000 });
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByText("Activity", { exact: true })).toBeVisible();
    for (const name of ["Notifications", "Search", "Timeline"]) await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(page.getByText("How it works")).toHaveCount(0);

    await nav.getByRole("link", { name: /^Timeline/ }).click();
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Campus timeline" }).locator("li").first()).toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole("link", { name: /^Timeline/ })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: /^Notifications/ }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all read" })).toBeVisible();

    await nav.getByRole("link", { name: /^Search/ }).click();
    await expect(page).toHaveURL(/\/search$/);
    await signOut(page);
    await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  }
});

test("the new pages are for signed-in people only", async ({ page }) => {
  for (const path of ["/notifications", "/timeline"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`), { timeout: 15_000 });
  }
});

test("timeline filters narrow the list; a student sees other people's reports but not their progress", async ({ page }) => {
  await signInAs(page, "Student", "student1@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await page.goto("/timeline");
  const rows = page.getByRole("list", { name: "Campus timeline" }).locator("li");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Work", exact: true }).click();
  // Another student's issues were started and resolved in the seed data, none of which this student may follow.
  const work = await rows.allTextContents();
  for (const t of work) expect(t).toMatch(/Work started|Resolved/);
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  for (const t of await rows.allTextContents()) expect(t).toMatch(/Reported by|Linked/);
});

test("notifications: unread count, filter, mark all read", async ({ page }) => {
  await signInAs(page, "Student", "student1@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  const unread = page.getByRole("button", { name: /^Unread \(/ });
  await expect(unread).toBeVisible({ timeout: 30_000 });
  const mark = page.getByRole("button", { name: "Mark all read" });
  if (await mark.isEnabled()) {
    await mark.click();
    await expect(unread).toHaveText("Unread (0)", { timeout: 30_000 });
  }
  await unread.click();
  await expect(page.getByText("No unread notifications")).toBeVisible();
});

test("report form: picking a building on the map fills in the place", async ({ page }) => {
  await signInAs(page, "Student", "student1@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await page.goto("/dashboard/report");
  await page.getByRole("button", { name: "Pick on the map" }).click();
  const map = page.getByRole("group", { name: /^SUES campus map/ });
  await expect(map).toBeVisible({ timeout: 30_000 });
  await map.locator("[data-place=blocks-1-4]").first().click();
  await expect(page.getByPlaceholder(/e\.g\. Block 4/)).toHaveValue(/Block/);
  await expect(page.getByLabel("Campus place (optional)")).not.toHaveValue("");
  await page.getByRole("button", { name: "Hide the map" }).click();
  await expect(map).toHaveCount(0);
});
