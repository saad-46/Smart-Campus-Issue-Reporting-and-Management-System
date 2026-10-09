import { expect, Page } from "@playwright/test";

export const SEEN_KEY = "smart-campus-viewer-guide-seen";

/** Skip the first-visit tour so a test starts on the page itself. */
export async function skipTour(page: Page) {
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage blocked */
    }
  }, SEEN_KEY);
}

/** Collect console problems and every request the page makes. */
export function watch(page: Page) {
  const problems: string[] = [];
  const requests: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("request", (r) => requests.push(r.url()));
  return { problems, requests };
}

export async function ready(page: Page) {
  await expect(page.locator("main h1").first()).toBeVisible();
}

export const roleButton = (page: Page, name: "Student" | "Worker" | "Admin") => page.getByRole("group", { name: "Choose a perspective" }).getByRole("button", { name });

export const VIEWER_ROUTES = [
  "/viewer",
  "/viewer/student",
  "/viewer/worker",
  "/viewer/admin",
  "/viewer/issues",
  "/viewer/issues/SC-1136",
  "/viewer/report",
  "/viewer/analytics",
  "/viewer/map",
  "/viewer/workers",
  "/viewer/finance",
  "/viewer/locations",
  "/viewer/notifications",
  "/viewer/search",
  "/viewer/timeline",
  "/viewer/settings",
  "/viewer/how-it-works",
];

export const VIEWPORTS = [
  [320, 568],
  [375, 667],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
] as const;
