import { expect, Page } from "@playwright/test";

// Helpers for the emulator-only registration tests. The one-time codes are read
// from the LOCAL emulators: emails from the capture collection that the server
// only writes when OTP_EMAIL_PROVIDER=capture AND the Auth emulator is running;
// SMS codes from the Auth emulator's own verification-code endpoint.

const FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-unifix/databases/(default)/documents";
const AUTH_EMULATOR = "http://127.0.0.1:9099";
export const PIN = "123456";

type FsDoc = { name: string; fields: Record<string, { stringValue?: string; integerValue?: string }> };

/** The newest emailed code for an address. */
export async function emailCode(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${FIRESTORE}/__otpCapture?pageSize=300`, { headers: { Authorization: "Bearer owner" } });
    const body = (await res.json()) as { documents?: FsDoc[] };
    const mine = (body.documents ?? []).filter((d) => d.fields.to?.stringValue === email.toLowerCase()).sort((a, b) => Number(b.fields.at?.integerValue ?? 0) - Number(a.fields.at?.integerValue ?? 0));
    if (mine[0]?.fields.code?.stringValue) return mine[0].fields.code.stringValue;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no code was captured for ${email}`);
}

/** The newest SMS code the Auth emulator "sent" to a number. */
export async function smsCode(phone: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/demo-unifix/verificationCodes`);
    const body = (await res.json()) as { verificationCodes?: { phoneNumber: string; code: string }[] };
    const mine = (body.verificationCodes ?? []).filter((c) => c.phoneNumber === phone);
    if (mine.length) return mine[mine.length - 1].code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no SMS code for ${phone}`);
}

export async function pickOption(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

export async function chooseRole(page: Page, role: "Report issues" | "Resolve issues" | "Manage campus") {
  await page.getByRole("radio", { name: new RegExp(role) }).click();
}

/** Send the emailed code from the Email section, read it from the capture, and verify it. */
export async function verifyEmail(page: Page, email: string) {
  await page.getByRole("button", { name: /^(Send|Resend) OTP$/ }).first().click();
  const code = await emailCode(email);
  await page.getByLabel("6-digit code sent to your email").fill(code);
  await page.getByRole("button", { name: "Verify OTP" }).click();
  await expect(page.getByText("Email verified")).toBeVisible({ timeout: 30_000 });
}

export interface StudentInput {
  college?: string | RegExp;
  roll?: string;
  year?: string;
  branch?: string | RegExp;
}

/**
 * Fill the whole registration form through the UI, verifying the email by OTP.
 * Does not submit; the caller clicks "Create account".
 */
export async function fillRegistration(
  page: Page,
  o: { kind: "student" | "worker" | "admin"; name: string; email: string; phone?: string; student?: StudentInput; workArea?: string; verify?: boolean }
) {
  await page.goto("/register");
  await chooseRole(page, o.kind === "student" ? "Report issues" : o.kind === "worker" ? "Resolve issues" : "Manage campus");
  await page.getByLabel("Full name").fill(o.name);
  await page.getByLabel(/^Email/).fill(o.email);
  await page.getByLabel("Phone number").fill(o.phone ?? "98765 43210");
  if (o.verify !== false) await verifyEmail(page, o.email);
  await page.getByLabel(/-digit PIN/).fill(PIN);
  if (o.kind === "student") {
    const s = o.student ?? {};
    await pickOption(page, "College / institution", s.college ?? /Muffakham/);
    await page.getByLabel("Roll number").fill(s.roll ?? "1604-21-737-042");
    await page.getByLabel("Academic year").selectOption(s.year ?? "3rd year");
    await pickOption(page, "Branch / department", s.branch ?? /^Computer Science and Engineering$/);
  }
  if (o.kind === "worker") await page.getByLabel("Team you work with").selectOption(o.workArea ?? "Electrical Maintenance");
}
