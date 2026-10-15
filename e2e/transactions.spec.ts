import { expect, Page, test } from "@playwright/test";
import { ready, skipTour, watch } from "./helpers";

// The Transactions ledger in Explore Mode (the same component the signed-in
// admin page uses), on the deterministic demo dataset.

const asAdmin = async (page: Page) => {
  await skipTour(page);
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("smart-campus-viewer-role", "admin");
    } catch {
      /* storage blocked */
    }
  });
};

test("transactions: summary, search, filters, sorting and details", async ({ page }) => {
  await asAdmin(page);
  const seen = watch(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/viewer/transactions");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.locator("aside nav").getByRole("link", { name: "Transactions", exact: true })).toHaveCount(1);

  // Summary figures are defined and use Indian grouping with two decimals.
  await expect(page.getByText("Incoming funds")).toBeVisible();
  await expect(page.getByText("Outgoing payments")).toBeVisible();
  await expect(page.getByText("Net movement")).toBeVisible();
  await expect(page.locator("dl")).toContainText(/₹[\d,]+\.\d{2}/);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const range = await page.getByText(/^\d+–\d+ of \d+$/).first().innerText();
  const count = Number(range.split(" of ")[1]);
  expect(count).toBeGreaterThan(0);

  // Search by transaction ID narrows to that entry.
  const firstId = (await table.locator("tbody tr").first().getByRole("button").innerText()).trim();
  const search = page.getByRole("searchbox", { name: "Search transactions" });
  await search.fill(firstId);
  await expect(table.locator("tbody tr")).toHaveCount(1);
  // No match gives an empty state with a way back.
  await search.fill("zzz-no-such-reference");
  await expect(page.getByText("No transactions match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(new RegExp(`of ${count}$`)).first()).toBeVisible();

  // Incoming only: the demo has no additions yet, so nothing matches and it says so.
  await page.getByLabel("Direction").selectOption("in");
  await expect(page.getByText("No transactions match")).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).click();

  // Sorting by amount flips with each press and exposes aria-sort.
  const amountHeader = page.getByRole("columnheader", { name: /Amount/ });
  await amountHeader.getByRole("button").click();
  await expect(amountHeader).toHaveAttribute("aria-sort", "descending");
  await amountHeader.getByRole("button").click();
  await expect(amountHeader).toHaveAttribute("aria-sort", "ascending");

  // Details open in a panel, are honest about what was recorded, and close with Escape.
  await table.locator("tbody tr").first().getByRole("button").click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Transaction ID");
  await expect(panel).toContainText("Entries are immutable");
  await expect(panel.getByRole("link", { name: "Open the related issue" })).toHaveAttribute("href", /\/viewer\/issues\/SC-\d+/);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  expect(seen.problems).toEqual([]);
});

test("transactions: demo funds appear as an incoming entry that the totals include", async ({ page }) => {
  await asAdmin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/viewer/finance");
  await page.getByRole("button", { name: "Add funds" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Amount/).fill("12345");
  await dialog.getByRole("button", { name: /Add/ }).last().click();
  await page.locator("aside nav").getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(page).toHaveURL(/\/viewer\/transactions$/);
  await ready(page);
  await expect(page.getByRole("table")).toContainText("Funds added during this demo visit");
  await expect(page.locator("dl")).toContainText("₹12,345.00");
});

test("transactions: usable on a phone, with no horizontal scrolling", async ({ page }) => {
  await asAdmin(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/viewer/transactions");
  await ready(page);
  await expect(page.getByRole("table")).toBeHidden();
  const list = page.getByRole("list", { name: "Transactions" });
  await expect(list).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await list.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toContainText("Transaction ID");
});

test("the signed-in transactions page is protected like the rest of the admin area", async ({ page }) => {
  await page.goto("/admin/transactions");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Ftransactions/, { timeout: 15_000 });
});
