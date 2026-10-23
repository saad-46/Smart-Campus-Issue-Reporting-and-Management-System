import { expect, Page, test } from "@playwright/test";

// Photo attachment and camera, in the signed-in report form, against the LOCAL
// emulators (same setup and guards as signed-in.emulator.spec.ts).
//
// What this proves: the UI, the permission handling, track cleanup and the file
// checks, using Chromium's FAKE camera (a generated test pattern) and scripted
// getUserMedia failures. It does NOT prove that a real phone or webcam works:
// see "Manual device checklist" in docs/CAMERA_PHOTOS.md.

const RUN = process.env.E2E_EMULATOR === "1";
const PASSWORD = process.env.SEED_PASSWORD || "emulator-only-demo";
// 1x1 PNG: the smallest valid image.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.describe.configure({ mode: "serial" });
test.skip(!RUN, "Emulator-only: set E2E_EMULATOR=1 and E2E_BASE_URL=http://localhost:<port>");
test.setTimeout(120_000);
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

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

/** Records every media track the page opens, so a test can check they were all stopped. */
async function trackMedia(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tracks: MediaStreamTrack[]; __gum: number };
    w.__tracks = [];
    w.__gum = 0;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) return;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      w.__gum++;
      const stream = await original(c);
      w.__tracks.push(...stream.getTracks());
      return stream;
    };
  });
}

const trackStates = (page: Page) => page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map((t) => t.readyState));
const gumCalls = (page: Page) => page.evaluate(() => (window as unknown as { __gum: number }).__gum);

async function openForm(page: Page) {
  await signIn(page, "student1@unifix.test");
  await page.goto("/dashboard/report");
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible({ timeout: 30_000 });
}

const addPhotoInput = (page: Page) => page.locator('input[type=file][accept^="image/jpeg"]');

test("the camera is not requested on page load, and a capture becomes the attached photo", async ({ page }) => {
  await trackMedia(page);
  await openForm(page);
  expect(await gumCalls(page)).toBe(0);

  await page.getByRole("button", { name: "Take photo" }).click();
  const dialog = page.getByRole("dialog", { name: "Take a photo" });
  await expect(dialog.getByLabel("Camera preview")).toBeVisible();
  const shoot = dialog.getByRole("button", { name: "Take photo" });
  await expect(shoot).toBeEnabled({ timeout: 15_000 });
  expect(await gumCalls(page)).toBe(1);
  await shoot.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByAltText("Photo 1")).toBeVisible({ timeout: 15_000 });
  // The captured frame is a real image, not a placeholder.
  expect(await page.getByAltText("Photo 1").getAttribute("src")).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
  // Every track was stopped once the photo was taken.
  expect((await trackStates(page)).length).toBeGreaterThan(0);
  expect(await trackStates(page)).toEqual((await trackStates(page)).map(() => "ended"));

  await page.getByRole("button", { name: "Remove photo 1" }).click();
  await expect(page.getByAltText("Photo 1")).toHaveCount(0);
});

test("cancelling the camera stops it, and the photo stays optional", async ({ page }) => {
  await trackMedia(page);
  await openForm(page);
  await page.getByRole("button", { name: "Take photo" }).click();
  const dialog = page.getByRole("dialog", { name: "Take a photo" });
  await expect(dialog.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await trackStates(page)).toEqual((await trackStates(page)).map(() => "ended"));
  await expect(page.getByAltText("Photo 1")).toHaveCount(0);
  // Closing with Escape does the same.
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(dialog.getByRole("button", { name: "Take photo" })).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await trackStates(page)).toEqual((await trackStates(page)).map(() => "ended"));
});

test("denied permission explains how to fix it and offers the upload path, which works", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await openForm(page);
  await page.getByRole("button", { name: "Take photo" }).click();
  const dialog = page.getByRole("dialog", { name: "Take a photo" });
  await expect(dialog).toContainText("Camera access is blocked");
  await expect(dialog).toContainText(/site settings/i);
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Upload a photo instead" }).click();
  await (await chooser).setFiles({ name: "fallback.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Photo 1")).toBeVisible({ timeout: 15_000 });
});

test("no camera, and no camera API at all, never block reporting", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("none", "NotFoundError"));
  });
  await openForm(page);
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("dialog", { name: "Take a photo" })).toContainText("No camera was found");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Submit issue" })).toBeEnabled();
});

test("without getUserMedia the live camera is not offered, but uploading still is", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });
  await openForm(page);
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await expect(addPhotoInput(page)).toHaveCount(1);
});

test("file picking: a valid image attaches; wrong type, empty and oversized files are refused; the limit is enforced; removing frees a slot", async ({ page }) => {
  await openForm(page);
  const input = addPhotoInput(page);
  await input.setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Photo 1")).toBeVisible({ timeout: 15_000 });

  await input.setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert").filter({ hasText: "JPG, PNG or WebP" })).toBeVisible();
  await input.setInputFiles({ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
  await expect(page.getByRole("alert").filter({ hasText: "empty" })).toBeVisible();
  await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1) });
  await expect(page.getByRole("alert").filter({ hasText: "smaller than" })).toBeVisible();
  await expect(page.getByAltText("Photo 2")).toHaveCount(0);

  await input.setInputFiles({ name: "b.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Photo 2")).toBeVisible({ timeout: 15_000 });
  await input.setInputFiles({ name: "c.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Photo 3")).toBeVisible({ timeout: 15_000 });
  // At the limit the add controls go away.
  await expect(addPhotoInput(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Remove photo 2" }).click();
  await expect(addPhotoInput(page)).toHaveCount(1);
});

test("a form error keeps the chosen photos, and the submitted report carries them", async ({ page }) => {
  await openForm(page);
  await addPhotoInput(page).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Photo 1")).toBeVisible({ timeout: 15_000 });
  // Missing title: refused, photo kept.
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await expect(page.getByAltText("Photo 1")).toBeVisible();
  await page.getByLabel("Title").fill(`TEST photo ${Date.now()}: loose ceiling tile`);
  await page.getByLabel("Describe the problem").fill("A ceiling tile is hanging loose above the desks.");
  await page.getByPlaceholder(/e\.g\. Block 4/).fill("Block 1, corridor");
  await page.getByRole("button", { name: /^Submit issue/ }).click();
  await page.waitForURL(/\/issues\/[A-Za-z0-9]+$/, { timeout: 60_000 });
  await expect(page.locator("main img").first()).toBeVisible({ timeout: 30_000 });
});

test("touch devices get the native camera input, not the live preview", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, permissions: ["camera"] });
  const page = await context.newPage();
  await openForm(page);
  await expect(page.locator('input[type=file][capture="environment"]')).toHaveCount(1);
  // No live-preview trigger (a <button>); the only "Take photo" is the native file input.
  await expect(page.locator("button", { hasText: "Take photo" })).toHaveCount(0);
  await context.close();
});

test("Explore keeps its sample photo and never touches the camera or a file", async ({ page }) => {
  await trackMedia(page);
  await page.goto("/viewer/report");
  await expect(page.getByText("Attach a sample photo")).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  expect(await gumCalls(page)).toBe(0);
});
