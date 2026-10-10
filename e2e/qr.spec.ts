import { expect, test } from "@playwright/test";
import { skipTour, watch } from "./helpers";

// QR links in Explore Mode. The signed-in QR flow is covered against the
// emulators in signed-in.emulator.spec.ts, and by tests/unit/qr.test.ts.

let seen: ReturnType<typeof watch>;

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.addInitScript(() => sessionStorage.setItem("smart-campus-viewer-role", "student"));
  seen = watch(page);
});

test.afterEach(async ({ baseURL }) => {
  const origin = new URL(baseURL!).origin;
  expect(seen.requests.filter((u) => !u.startsWith(origin) && !/^(data|blob):/.test(u))).toEqual([]);
  expect(seen.requests.filter((u) => /firestore|firebase|identitytoolkit|securetoken|googleapis/i.test(u))).toEqual([]);
  expect(seen.problems).toEqual([]);
});

const NOT_RECOGNISED = "That QR code isn't recognised";

test.describe("QR links", () => {
  test("every researched location resolves to itself and shows its confidence", async ({ page }) => {
    const ids = ["mjcet-block-1", "mjcet-seminar-hall", "mjcet-ghulam-ahmed-hall", "mjcet-central-library", "sucp-college", "mjcet-garden"];
    const expected: Record<string, RegExp> = {
      "mjcet-block-1": /Approximate position/,
      "mjcet-ghulam-ahmed-hall": /Sources disagree/,
      "mjcet-central-library": /won't appear on the map/,
    };
    for (const id of ids) {
      await page.goto(`/viewer/report?location=${id}`);
      await expect(page.getByLabel("Location", { exact: true })).toHaveValue(id);
      await expect(page.getByText(NOT_RECOGNISED)).toHaveCount(0);
      if (expected[id]) await expect(page.getByTestId("location-detail")).toContainText(expected[id]);
    }
  });

  test("unknown, malformed, empty and tampered ids are refused and leave the location empty", async ({ page }) => {
    const refused = [
      "no-such-place",
      "mjcet-block-99",
      "MJCET-BLOCK-1",
      "mjcet-block-1%20",
      "mjcet-block-1%00",
      "..%2F..%2Fadmin",
      "%2e%2e%2f",
      "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      "mjcet-block-1'%20OR%20'1'='1",
      "a".repeat(61),
      "mjcet-block-1,mjcet-block-2",
      "%E2%80%AEmjcet-block-1", // right-to-left override character in front of a valid id
    ];
    for (const id of refused) {
      await page.goto(`/viewer/report?location=${id}`);
      await expect(page.getByText(NOT_RECOGNISED), id).toBeVisible();
      await expect(page.getByLabel("Location", { exact: true }), id).toHaveValue("");
    }
    // An empty value is "no QR code", not a bad one.
    await page.goto("/viewer/report?location=");
    await expect(page.getByText(NOT_RECOGNISED)).toHaveCount(0);
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("");
  });

  test("a repeated parameter uses the first value only, and extra parameters change nothing", async ({ page }) => {
    await page.goto("/viewer/report?location=mjcet-block-2&location=mjcet-block-5&role=admin&locationId=mjcet-block-5");
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("mjcet-block-2");
    await expect(page.getByTestId("location-detail")).toContainText("Block 2");
    await expect(page.getByRole("group", { name: "Choose a perspective" }).getByRole("button", { name: "Student" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the place shown is the place submitted, and the report is the demo's", async ({ page }) => {
    await page.goto("/viewer/report?location=mjcet-seminar-hall");
    await page.getByLabel("Title").fill("Microphone crackles in the seminar hall");
    await page.getByLabel("What is wrong?").fill("The microphone crackles loudly when anyone speaks.");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toBeVisible();
    await page.getByRole("link", { name: /^Open SC-\d+/ }).click();
    await expect(page.locator("header").filter({ hasText: /SC-\d+/ })).toContainText("Seminar Hall, Block 4");
    await expect(page.locator("main")).toContainText("Created in this demo");
  });

  test("changing to an invalid choice after a valid one is a validation error, then a correction submits", async ({ page }) => {
    await page.goto("/viewer/report?location=mjcet-block-4");
    await page.getByLabel("Title").fill("Tap dripping in the washroom");
    await page.getByLabel("What is wrong?").fill("The tap does not close fully and drips all day.");
    await page.getByLabel("Location", { exact: true }).selectOption("");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByText("Choose where the problem is.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toHaveCount(0);
    await page.getByLabel("Location", { exact: true }).selectOption({ label: "Block 4" });
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toBeVisible();
  });

  test("renders without horizontal scroll on a phone, and the QR dialog draws a code", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/viewer/report?location=mjcet-block-3");
    await expect(page.getByTestId("location-detail")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/viewer/report?location=nope");
    await expect(page.getByText(NOT_RECOGNISED)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.addInitScript(() => sessionStorage.setItem("smart-campus-viewer-role", "admin"));
    await page.goto("/viewer/locations?location=mjcet-seminar-hall");
    const dialog = page.getByRole("dialog", { name: "Location QR code" });
    await expect(dialog.getByRole("img", { name: /QR code for reporting an issue at Seminar Hall/ })).toBeVisible();
    // The link a scan opens is the demo form, never the signed-in one, and carries only the id.
    const link = await dialog.locator("p.font-mono").innerText();
    expect(link).toMatch(/\/viewer\/report\?location=mjcet-seminar-hall$/);
    expect(link).not.toMatch(/dashboard|token|uid|email|@/i);
  });
});
