import { expect, Page, test } from "@playwright/test";
import { PIN, chooseRole, emailCode, fillRegistration, pickOption, smsCode } from "./otpHelpers";

// Registration, OTP verification, the three roles and the searchable dropdowns,
// against the LOCAL emulators (same setup and guards as signed-in.emulator.spec.ts;
// the dev server also needs OTP_EMAIL_PROVIDER=capture and NEXT_PUBLIC_PHONE_OTP_ENABLED=true,
// see docs/REGISTRATION_OTP.md). Never runs against production.

const RUN = process.env.E2E_EMULATOR === "1";
const PASSWORD = process.env.SEED_PASSWORD || "emulator-only-demo";
const STAMP = String(Date.now()).slice(-7);
const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-unifix/databases/(default)/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";

test.describe.configure({ mode: "serial" });
test.skip(!RUN, "Emulator-only: set E2E_EMULATOR=1 and E2E_BASE_URL=http://localhost:<port>");
test.setTimeout(120_000);

test.beforeAll(({}, info) => {
  const base = String(info.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "");
  if (RUN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) throw new Error(`Refusing to run signed-in tests against ${base}`);
});

/** Every scenario sends from its own "address", so the per-address hourly cap is not shared (honoured only by emulator builds). */
async function ownAddress(page: Page, id: string) {
  await page.route("**/api/otp/email/send", (route) => route.continue({ headers: { ...route.request().headers(), "x-otp-test-ip": `${id}-${STAMP}` } }));
}

async function signInAs(page: Page, role: "Student" | "Worker" | "Admin", email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: `Sign in as ${role}` }).click();
  await page.getByLabel("Email").first().fill(email);
  await page.getByLabel("Password").first().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
}

async function rest<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const { token, ...rest } = init;
  const res = await fetch(url, { ...rest, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? "owner"}`, ...(rest.headers ?? {}) } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

// No Authorization header: the Auth emulator treats "Bearer owner" as a privileged call and returns no token.
const authCall = async (path: string, body: unknown) => {
  const res = await fetch(`${AUTH}/${path}?key=demo-placeholder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { idToken: string; localId: string } };
};

async function profileOf(email: string) {
  const list = await rest<{ documents?: { name: string; fields: Record<string, { stringValue?: string }> }[] }>(`${FIRESTORE}/users?pageSize=300`);
  return (list.body.documents ?? []).find((d) => d.fields.email?.stringValue === email.toLowerCase())?.fields;
}

// ---------------------------------------------------------------- roles

test("three role choices, with the fields each one needs", async ({ page }) => {
  await page.goto("/register");
  const roles = page.getByRole("radiogroup", { name: "How will you use UniFix?" }).getByRole("radio");
  await expect(roles).toHaveCount(3);
  await expect(roles.nth(0)).toContainText("Report issues");
  await expect(roles.nth(0)).toContainText("Student");
  await expect(roles.nth(1)).toContainText("Resolve issues");
  await expect(roles.nth(2)).toContainText("Manage campus");
  await expect(page.locator("main")).not.toContainText("or staff");
  await expect(roles.nth(0)).toHaveAttribute("aria-checked", "true");
  for (const label of ["College / institution", "Roll number", "Academic year", "Branch / department"]) await expect(page.getByLabel(label).first()).toBeVisible();

  await roles.nth(1).click();
  await expect(roles.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Team you work with")).toBeVisible();
  await expect(page.getByLabel("College / institution")).toHaveCount(0);

  await roles.nth(2).click();
  await expect(page.getByText("granted by the campus team")).toBeVisible();
  await expect(page.getByLabel("Team you work with")).toHaveCount(0);
  await expect(page.getByLabel("College / institution")).toHaveCount(0);
  // Every role still asks for the contact details and PIN.
  for (const label of [/^Email/, "Phone number", /-digit PIN/]) await expect(page.getByLabel(label).first()).toBeVisible();
});

test("keyboard: the role cards are reachable and switch with Space", async ({ page }) => {
  await page.goto("/register");
  const worker = page.getByRole("radio", { name: /Resolve issues/ });
  await worker.focus();
  await page.keyboard.press("Space");
  await expect(worker).toHaveAttribute("aria-checked", "true");
});

// ---------------------------------------------------------------- dropdowns

test("college dropdown: opens on focus, ranks matches, keyboard and no-match behaviour", async ({ page }) => {
  await page.goto("/register");
  const college = page.getByRole("combobox", { name: "College / institution" });
  await college.focus();
  const list = page.getByRole("listbox", { name: "College / institution" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("option")).toHaveCount(8); // seven institutions + "isn't listed"

  await college.fill("phar");
  await expect(list.getByRole("option").first()).toContainText("College of Pharmacy");
  // A word match ranks above a mere substring: "law" finds the College of Law first.
  await college.fill("law");
  await expect(list.getByRole("option").first()).toContainText("College of Law");
  // Prefix beats word-in-the-middle.
  await college.fill("mu");
  await expect(list.getByRole("option").first()).toContainText("Muffakham Jah");
  await college.fill("zzzz");
  await expect(list).toContainText("No match found.");
  await expect(list.getByRole("option")).toHaveCount(1); // only "isn't listed" remains

  // Typing something that is not an option never becomes the value.
  await page.keyboard.press("Tab");
  await expect(college).toHaveValue("");
  await expect(list).toHaveCount(0);

  // Keyboard: arrows move, Enter chooses (and does not submit the form), Escape closes.
  await college.focus();
  await page.keyboard.press("ArrowDown"); // from the first (Muffakham) to the second (Pharmacy)
  await page.keyboard.press("Enter");
  await expect(college).toHaveValue(/Sultan-ul-Uloom College of Pharmacy/);
  await expect(page).toHaveURL(/\/register$/);
  await college.click();
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(college).toHaveValue(/Pharmacy/);

  // Typing an exact name and leaving selects it.
  await college.fill("Sultan-Ul-Uloom College of Law");
  await page.keyboard.press("Tab");
  await expect(college).toHaveValue("Sultan-Ul-Uloom College of Law");
});

test("branch dropdown follows the college, and 'isn't listed' is an explicit choice", async ({ page }) => {
  await page.goto("/register");
  const branch = page.getByRole("combobox", { name: "Branch / department" });
  await expect(branch).toBeDisabled();
  await pickOption(page, "College / institution", /Muffakham/);
  await expect(branch).toBeEnabled();
  await branch.click();
  const list = page.getByRole("listbox", { name: "Branch / department" });
  await expect(list.getByRole("option", { name: /AI & ML/ })).toBeVisible();
  await branch.fill("e");
  // Both prefix matches come before words that merely contain an "e".
  await expect(list.getByRole("option").nth(0)).toContainText("Electronics and Communication Engineering");
  await branch.fill("data");
  await expect(list.getByRole("option").first()).toContainText("(Data Science)");
  await list.getByRole("option").first().click();
  await expect(branch).toHaveValue(/Data Science/);

  // Another college has a different list; the old branch is dropped.
  await pickOption(page, "College / institution", /College of Pharmacy/);
  await expect(page.getByRole("combobox", { name: "Branch / department" })).toHaveValue("");
  await page.getByRole("combobox", { name: "Branch / department" }).click();
  await expect(page.getByRole("listbox", { name: "Branch / department" }).getByRole("option", { name: "Pharmacy" })).toBeVisible();

  // A college that is not listed asks for its name and branch as plain text.
  await pickOption(page, "College / institution", /isn't listed/);
  await expect(page.getByLabel("Institution name")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Branch \/ department/ })).toBeVisible();
});

test("dropdowns stay inside a phone screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByRole("combobox", { name: "College / institution" }).tap();
  const list = page.getByRole("listbox", { name: "College / institution" });
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await list.getByRole("option", { name: /Muffakham/ }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

// ---------------------------------------------------------------- email OTP

test("email OTP: required, rejects wrong codes, expires on edit, and gates account creation", async ({ page }) => {
  await ownAddress(page, "otp-ui");
  const email = `ui-${STAMP}@unifix.test`;
  await page.goto("/register");
  const send = page.getByRole("button", { name: /^(Send|Resend) OTP$/ }).first();
  await expect(send).toBeDisabled(); // no address yet
  await page.getByLabel("Full name").fill("TEST UI");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel("Phone number").fill("98765 43210");
  await page.getByLabel(/-digit PIN/).fill(PIN);
  await expect(send).toBeEnabled();

  // Everything else filled, nothing verified: the account is not created.
  await pickOption(page, "College / institution", /Muffakham/);
  await page.getByLabel("Roll number").fill("R-1");
  await page.getByLabel("Academic year").selectOption("1st year");
  await pickOption(page, "Branch / department", /^Civil Engineering$/);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Verify your email or phone number with a one-time code")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  await send.click();
  await expect(page.getByRole("button", { name: /^Resend in \d+s$/ })).toBeDisabled();
  const code = await emailCode(email);
  const wrong = code === "000000" ? "111111" : "000000";
  const box = page.getByLabel("6-digit code sent to your email");
  await box.fill(wrong);
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("That code isn't right")).toBeVisible();
  await expect(page.getByText("Email verified")).toHaveCount(0);

  // Letters are not accepted into the code box.
  await box.fill("12ab34");
  await expect(box).toHaveValue("1234");
  await box.fill(code);
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("Email verified")).toBeVisible({ timeout: 30_000 });

  // Changing the address invalidates the verification; the old code is useless for the new one.
  await page.getByLabel(/^Email/).fill(`other-${STAMP}@unifix.test`);
  await expect(page.getByText("Email verified")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send OTP" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Verify your email or phone number with a one-time code")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  // Going back to the first address does not bring the verification back.
  await page.getByLabel(/^Email/).fill(email);
  await expect(page.getByText("Email verified")).toHaveCount(0);
});

test("a student registers after verifying only the email; details show and the banner stays away", async ({ page }) => {
  await ownAddress(page, "student");
  const email = `student-${STAMP}@unifix.test`;
  await fillRegistration(page, { kind: "student", name: `TEST Student ${STAMP}`, email, phone: "98765 43210" });
  const create = page.getByRole("button", { name: "Create account" });
  await create.click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const card = page.getByLabel("Student details", { exact: true }).first();
  await expect(card).toContainText("Muffakham Jah College of Engineering and Technology", { timeout: 30_000 });
  await expect(card).toContainText("Roll no. 1604-21-737-042");
  await expect(card).toContainText("3rd year");
  await expect(card).toContainText("Computer Science and Engineering");
  await expect(page.getByText("Add your student details")).toHaveCount(0);

  const p = await profileOf(email);
  expect(p?.phone?.stringValue).toBe("+919876543210");
  expect(p?.verifiedVia?.stringValue).toBe("email");
  expect(p?.role?.stringValue).toBe("user");
  expect(p?.workerRequest).toBeUndefined();
  expect(p?.adminRequest).toBeUndefined();

  // Persists across a reload and a fresh sign-in, with no banner.
  await page.reload();
  await expect(page.getByLabel("Student details", { exact: true }).first()).toContainText("Roll no. 1604-21-737-042", { timeout: 30_000 });
  await expect(page.getByText("Add your student details")).toHaveCount(0);
  await signOut(page);
  await signInAs(page, "Student", email, PIN);
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByLabel("Student details", { exact: true }).first()).toContainText("Computer Science and Engineering", { timeout: 30_000 });
  await expect(page.getByText("Add your student details")).toHaveCount(0);
});

test("submitting an empty form explains every missing student field and creates nothing", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  for (const text of ["Enter your full name.", "Enter your email address.", "Enter your phone number.", "Enter your 6-digit PIN.", "Choose your college from the list.", "Enter your roll number.", "Choose your academic year.", "Verify your email or phone number with a one-time code"]) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
  await expect(page).toHaveURL(/\/register$/);
});

test("saved details are edited with the same searchable lists, and the banner stays away", async ({ page }) => {
  await ownAddress(page, "edit");
  const email = `edit-${STAMP}@unifix.test`;
  await fillRegistration(page, { kind: "student", name: "TEST Edit", email });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const card = page.getByLabel("Student details", { exact: true }).first();
  await card.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Student details" });
  await expect(dialog.getByRole("combobox", { name: "College / institution" })).toHaveValue(/Muffakham/);
  await dialog.getByRole("combobox", { name: "Branch / department" }).click();
  await dialog.getByRole("option", { name: /^Mechanical Engineering$/ }).click();
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(card).toContainText("Mechanical Engineering"); // immediately, without a reload
  await expect(page.getByText("Add your student details")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Student details", { exact: true }).first()).toContainText("Mechanical Engineering", { timeout: 30_000 });
  await signOut(page);
});

test("a double click on Create account makes one account", async ({ page }) => {
  await ownAddress(page, "double");
  const email = `double-${STAMP}@unifix.test`;
  await fillRegistration(page, { kind: "student", name: "TEST Double", email });
  await page.getByRole("button", { name: "Create account" }).dblclick();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const list = await rest<{ documents?: { fields: Record<string, { stringValue?: string }> }[] }>(`${FIRESTORE}/users?pageSize=300`);
  expect((list.body.documents ?? []).filter((d) => d.fields.email?.stringValue === email)).toHaveLength(1);
  await signOut(page);
});

test("an interrupted registration can be finished with the same email and PIN", async ({ page }) => {
  await ownAddress(page, "resume");
  const email = `resume-${STAMP}@unifix.test`;
  // Step 1 happened: the account exists in Auth but never got a profile.
  const made = await authCall("accounts:signUp", { email, password: PIN, returnSecureToken: true });
  expect(made.status).toBe(200);
  await fillRegistration(page, { kind: "student", name: "TEST Resume", email });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  expect((await profileOf(email))?.id?.stringValue).toBe(made.body.localId);
  await signOut(page);
});

test("an email that already has an account is refused, not taken over", async ({ page }) => {
  await ownAddress(page, "taken");
  await fillRegistration(page, { kind: "student", name: "TEST Taken", email: "student1@unifix.test" });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert").or(page.getByText(/already registered|already in use/i)).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/register$/);
});

// ---------------------------------------------------------------- the server and the rules, called directly

test("the OTP API: bad input, cooldown, attempt limit, single use and bound to the address", async ({ request }) => {
  const ip = { "x-otp-test-ip": `api-${STAMP}` };
  expect((await request.post("/api/otp/email/send", { data: { email: "nope" }, headers: ip })).status()).toBe(400);
  expect((await request.post("/api/otp/email/send", { data: "not json", headers: ip })).status()).toBe(400);

  const email = `api-${STAMP}@unifix.test`;
  const sent = await request.post("/api/otp/email/send", { data: { email }, headers: ip });
  expect(sent.status()).toBe(200);
  const { challengeId } = await sent.json();
  // Asking again straight away is a cool-down, not another code.
  const again = await request.post("/api/otp/email/send", { data: { email }, headers: ip });
  expect(again.status()).toBe(429);
  expect(Number(again.headers()["retry-after"])).toBeGreaterThan(0);

  const code = await emailCode(email);
  const wrong = code === "000000" ? "111111" : "000000";
  // Another address cannot use this challenge.
  expect((await request.post("/api/otp/email/verify", { data: { challengeId, email: `x-${email}`, code } })).status()).toBe(400);
  for (let i = 0; i < 5; i++) expect((await request.post("/api/otp/email/verify", { data: { challengeId, email, code: wrong } })).status()).toBe(400);
  // After five misses even the right code is refused.
  const locked = await request.post("/api/otp/email/verify", { data: { challengeId, email, code } });
  expect(locked.status()).toBe(400);
  expect((await locked.json()).code).toBe("locked");

  // A fresh challenge: the right code works exactly once.
  const email2 = `api2-${STAMP}@unifix.test`;
  const sent2 = await request.post("/api/otp/email/send", { data: { email: email2 }, headers: ip });
  const c2 = (await sent2.json()).challengeId;
  const code2 = await emailCode(email2);
  const ok = await request.post("/api/otp/email/verify", { data: { challengeId: c2, email: email2, code: code2 } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ticket.length).toBeGreaterThan(20);
  const reuse = await request.post("/api/otp/email/verify", { data: { challengeId: c2, email: email2, code: code2 } });
  expect((await reuse.json()).code).toBe("used");
  // The code never appears in a response.
  expect(JSON.stringify(await sent2.json())).not.toContain(code2);
});

test("a ticket only works for its own address, once, and only for a signed-in caller", async ({ request }) => {
  const ip = { "x-otp-test-ip": `ticket-${STAMP}` };
  const emailA = `ta-${STAMP}@unifix.test`;
  const emailB = `tb-${STAMP}@unifix.test`;
  const sent = await request.post("/api/otp/email/send", { data: { email: emailA }, headers: ip });
  const { challengeId } = await sent.json();
  const { ticket } = await (await request.post("/api/otp/email/verify", { data: { challengeId, email: emailA, code: await emailCode(emailA) } })).json();

  expect((await request.post("/api/register/complete", { data: { ticket } })).status()).toBe(401);
  expect((await request.post("/api/register/complete", { data: { ticket }, headers: { Authorization: "Bearer not-a-token" } })).status()).toBe(401);

  const b = await authCall("accounts:signUp", { email: emailB, password: PIN, returnSecureToken: true });
  const bad = await request.post("/api/register/complete", { data: { ticket }, headers: { Authorization: `Bearer ${b.body.idToken}` } });
  expect(bad.status()).toBe(400); // someone else's ticket
  expect((await request.post("/api/register/complete", { data: { ticket: "x".repeat(30) }, headers: { Authorization: `Bearer ${b.body.idToken}` } })).status()).toBe(400);

  const a = await authCall("accounts:signUp", { email: emailA, password: PIN, returnSecureToken: true });
  const auth = { Authorization: `Bearer ${a.body.idToken}` };
  expect((await request.post("/api/register/complete", { data: { ticket }, headers: auth })).status()).toBe(200);
  expect((await request.post("/api/register/complete", { data: { ticket }, headers: auth })).status()).toBe(400); // already spent
});

test("without the server's proof, no client can create a profile, even with a hand-made request", async () => {
  const email = `bypass-${STAMP}@unifix.test`;
  const made = await authCall("accounts:signUp", { email, password: PIN, returnSecureToken: true });
  expect(made.status).toBe(200);
  const fields = {
    id: { stringValue: made.body.localId },
    name: { stringValue: "Bypass" },
    email: { stringValue: email },
    role: { stringValue: "user" },
    roles: { arrayValue: { values: [{ stringValue: "user" }] } },
    activeRole: { stringValue: "user" },
    createdAt: { stringValue: new Date().toISOString() },
    phone: { stringValue: "+919876543210" },
    verifiedVia: { stringValue: "email" },
    college: { stringValue: "Muffakham Jah College of Engineering and Technology" },
    rollNumber: { stringValue: "R1" },
    academicYear: { stringValue: "1st year" },
    branch: { stringValue: "Civil Engineering" },
  };
  const write = await rest(`${FIRESTORE}/users/${made.body.localId}`, { method: "PATCH", token: made.body.idToken, body: JSON.stringify({ fields }) });
  expect(write.status).toBe(403);
  expect(await profileOf(email)).toBeUndefined();
});

// ---------------------------------------------------------------- phone OTP

test("phone OTP: a student can register by verifying the phone instead, and the phone cannot be reused", async ({ page }) => {
  await ownAddress(page, "phone");
  const email = `phone-${STAMP}@unifix.test`;
  const number = `+9190000${STAMP}`.slice(0, 13);
  await fillRegistration(page, { kind: "student", name: "TEST Phone", email, phone: number, verify: false });
  await page.getByRole("button", { name: /^Send OTP$/ }).nth(1).click();
  const box = page.getByLabel("6-digit code sent to your phone");
  const wrong = (await smsCode(number)) === "000000" ? "111111" : "000000";
  await box.fill(wrong);
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText(/isn't right/)).toBeVisible({ timeout: 30_000 });
  await box.fill(await smsCode(number));
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("Phone verified")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const p = await profileOf(email);
  expect(p?.verifiedVia?.stringValue).toBe("phone");
  expect(p?.phone?.stringValue).toBe(number);
  await signOut(page);
  // The linked email and PIN sign in to the same account.
  await signInAs(page, "Student", email, PIN);
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await signOut(page);

  // The same number cannot start a second account.
  await fillRegistration(page, { kind: "student", name: "TEST Phone Two", email: `phone2-${STAMP}@unifix.test`, phone: number, verify: false });
  await page.getByRole("button", { name: /^Send OTP$/ }).nth(1).click();
  await page.getByLabel("6-digit code sent to your phone").fill(await smsCode(number));
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText(/already registered/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Phone verified")).toHaveCount(0);
});

// ---------------------------------------------------------------- worker and admin

test("leaving after verifying a phone drops that session and does not block the next sign-in", async ({ page }) => {
  await ownAddress(page, "leave");
  const number = `+9190001${STAMP}`.slice(0, 13);
  await fillRegistration(page, { kind: "student", name: "TEST Leaver", email: `leaver-${STAMP}@unifix.test`, phone: number, verify: false });
  await page.getByRole("button", { name: /^Send OTP$/ }).nth(1).click();
  await page.getByLabel("6-digit code sent to your phone").fill(await smsCode(number));
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("Phone verified")).toBeVisible({ timeout: 30_000 });
  // Leave without creating the account, then sign in as someone else.
  await signInAs(page, "Student", "student3@unifix.test");
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "My issues" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^Account menu for Demo Student 3/ })).toBeVisible();
  await signOut(page);
});

test("walking away inside the app after verifying a phone also leaves nothing behind", async ({ page }) => {
  await ownAddress(page, "leave2");
  const number = `+9190002${STAMP}`.slice(0, 13);
  await fillRegistration(page, { kind: "student", name: "TEST Walker", email: `walker-${STAMP}@unifix.test`, phone: number, verify: false });
  await page.getByRole("button", { name: /^Send OTP$/ }).nth(1).click();
  await page.getByLabel("6-digit code sent to your phone").fill(await smsCode(number));
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("Phone verified")).toBeVisible({ timeout: 30_000 });
  // A client-side navigation: the page unmounts instead of reloading.
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/login$/);
  await page.getByLabel("Email").first().fill("student3@unifix.test");
  await page.getByLabel("Password").first().fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^Account menu for Demo Student 3/ })).toBeVisible({ timeout: 30_000 });
  await signOut(page);
});

test("a worker registers with a work area, is a student until approved, then sees their team's issues first", async ({ page }) => {
  await ownAddress(page, "worker");
  const email = `worker-${STAMP}@unifix.test`;
  await fillRegistration(page, { kind: "worker", name: `TEST Worker ${STAMP}`, email, workArea: "IT Services" });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const p = await profileOf(email);
  expect(p?.workerRequest?.stringValue).toBe("pending");
  expect(p?.workArea?.stringValue).toBe("IT Services");
  expect(p?.role?.stringValue).toBe("user");
  expect(p?.college).toBeUndefined();
  // Not a worker yet.
  await page.goto("/worker");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await signOut(page);
  await signInAs(page, "Worker", email, PIN);
  await expect(page.getByText(/still waiting for approval/)).toBeVisible({ timeout: 30_000 });

  // An administrator approves from the overview.
  await signInAs(page, "Admin", "admin@unifix.test");
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  const card = page.getByRole("heading", { name: "Worker access requests" }).locator("xpath=ancestor::div[contains(@class,'glass')][1]");
  await card.getByRole("button", { name: `Approve TEST Worker ${STAMP}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(card.locator("li", { hasText: `TEST Worker ${STAMP}` })).toHaveCount(0, { timeout: 30_000 });
  await signOut(page);

  await signInAs(page, "Worker", email, PIN);
  await page.waitForURL(/\/worker$/, { timeout: 60_000 });
  await page.getByRole("tab", { name: /^Open pool/ }).click();
  await expect(page.getByText("Showing issues for IT Services first.")).toBeVisible({ timeout: 30_000 });
  await signOut(page);
});

test("an administrator request grants nothing until an existing administrator approves it on the server", async ({ page, request }) => {
  await ownAddress(page, "admin");
  const email = `adminreq-${STAMP}@unifix.test`;
  await fillRegistration(page, { kind: "admin", name: `TEST Admin ${STAMP}`, email });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  const p = await profileOf(email);
  expect(p?.adminRequest?.stringValue).toBe("pending");
  expect(p?.role?.stringValue).toBe("user");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByText("Add your student details")).toHaveCount(0); // an admin request is not a student
  await signOut(page);
  await signInAs(page, "Admin", email, PIN);
  await expect(page.getByText(/still waiting for approval/)).toBeVisible({ timeout: 30_000 });

  // The requester cannot approve themselves through the server door either.
  const me = await authCall("accounts:signInWithPassword", { email, password: PIN, returnSecureToken: true });
  const self = await request.post("/api/admin/admin-access", { data: { userId: me.body.localId, decision: "approve" }, headers: { Authorization: `Bearer ${me.body.idToken}` } });
  expect(self.status()).toBe(403);
  expect((await request.post("/api/admin/admin-access", { data: { userId: me.body.localId, decision: "approve" } })).status()).toBe(401);
  // Nor can an ordinary student or a worker.
  for (const who of ["student2@unifix.test", "worker2@unifix.test"]) {
    const t = await authCall("accounts:signInWithPassword", { email: who, password: PASSWORD, returnSecureToken: true });
    expect((await request.post("/api/admin/admin-access", { data: { userId: me.body.localId, decision: "approve" }, headers: { Authorization: `Bearer ${t.body.idToken}` } })).status()).toBe(403);
  }
  expect(await rest(`${FIRESTORE}/admins/${me.body.localId}`).then((r) => r.status)).toBe(404);

  // An existing administrator approves, after a confirmation.
  await signInAs(page, "Admin", "admin@unifix.test");
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  const card = page.getByRole("heading", { name: "Administrator access requests" }).locator("xpath=ancestor::div[contains(@class,'glass')][1]");
  await expect(card.locator("li", { hasText: `TEST Admin ${STAMP}` })).toContainText(email, { timeout: 30_000 });
  await card.getByRole("button", { name: `Approve administrator request from TEST Admin ${STAMP}` }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("see and change all campus data");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect(await rest(`${FIRESTORE}/admins/${me.body.localId}`).then((r) => r.status)).toBe(404);
  await card.getByRole("button", { name: `Approve administrator request from TEST Admin ${STAMP}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Make administrator" }).click();
  await expect(card.locator("li", { hasText: `TEST Admin ${STAMP}` })).toHaveCount(0, { timeout: 30_000 });
  await signOut(page);

  await signInAs(page, "Admin", email, PIN);
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  // The request is spent: it cannot be approved twice.
  const again = await request.post("/api/admin/admin-access", { data: { userId: me.body.localId, decision: "approve" }, headers: { Authorization: `Bearer ${(await authCall("accounts:signInWithPassword", { email: "admin@unifix.test", password: PASSWORD, returnSecureToken: true })).body.idToken}` } });
  expect(again.status()).toBe(409);
});

test("registration pages work on a tablet and a phone", async ({ browser }) => {
  for (const [w, h] of [[768, 1024], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.goto("/register");
    for (const role of ["Report issues", "Resolve issues", "Manage campus"]) {
      await chooseRole(page, role as "Report issues");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${role} at ${w}px`).toBe(true);
    }
    await context.close();
  }
});
