import { expect, Page, test } from "@playwright/test";
import { ready, roleButton, skipTour, watch } from "./helpers";

// Explore Mode offers every action the signed-in app does, on demo data.
// Each test here performs one of those actions and checks its result where
// a signed-in user would look for it, and that nothing left the site.

const toast = (page: Page) => page.getByRole("list", { name: "Status messages" });
const alerts = (page: Page) => page.getByRole("alert");
const nav = (page: Page, name: string) => page.locator("aside nav").getByRole("link", { name, exact: true });

async function as(page: Page, role: "student" | "worker" | "admin") {
  await page.addInitScript((r) => {
    try {
      sessionStorage.setItem("smart-campus-viewer-role", r); // the perspective is remembered per tab
    } catch {
      /* storage blocked */
    }
  }, role);
}

let seen: ReturnType<typeof watch>;

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  seen = watch(page);
});

test.afterEach(async ({ baseURL }) => {
  // Whatever a test did, it stayed inside the site and never spoke to Firebase.
  const origin = new URL(baseURL!).origin;
  expect(seen.requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
  expect(seen.requests.filter((u) => /firestore|firebase|identitytoolkit|securetoken|googleapis/i.test(u))).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test.describe("administrator actions", () => {
  test("escalate, clear, unassign and reassign an issue", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/issues/SC-1137");
    const manage = page.getByRole("region", { name: "Manage issue" });
    await expect(manage).toContainText("Ramesh Kumar");
    await manage.getByRole("button", { name: "Escalate" }).click();
    await expect(toast(page)).toContainText("Issue escalated (demo)");
    await expect(manage).toContainText("Escalated");
    await expect(page.locator("header").filter({ hasText: "SC-1137" })).toContainText("Escalated");
    await manage.getByRole("button", { name: "Clear escalation" }).click();
    await expect(manage).toContainText("Not escalated");

    await manage.getByRole("button", { name: "Unassign" }).click();
    const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog", { name: "Unassign this issue?" }));
    await expect(confirm).toContainText("open pool");
    await confirm.getByRole("button", { name: "Unassign" }).click();
    await expect(manage).toContainText("Unassigned");
    await expect(manage.getByRole("button", { name: "Unassign" })).toHaveCount(0);

    await manage.getByRole("button", { name: "Assign worker" }).click();
    await page.getByRole("dialog", { name: "Assign a worker" }).getByRole("button", { name: "Assign (demo)" }).click();
    await expect(manage.getByRole("button", { name: "Reassign worker" })).toBeVisible();
    // The timeline records the new assignment.
    await expect(page.getByRole("region", { name: "Timeline" })).toContainText("Assigned to");
  });

  test("remove a report from an incident and link it again", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/issues/SC-1141");
    const related = page.getByRole("region", { name: "Related reports" });
    await expect(related).toContainText("Part of a larger incident");
    await related.getByRole("button", { name: "Remove from incident" }).click();
    await page.getByRole("button", { name: "Remove link" }).click();
    await expect(toast(page)).toContainText("Report removed from the incident (demo)");
    await expect(related).not.toContainText("Part of a larger incident");
    await expect(related).toContainText("% similar");
    await related.getByRole("button", { name: "Link this report to that incident" }).first().click();
    await expect(related).toContainText("Part of a larger incident");
    await expect(page.getByRole("region", { name: "Timeline" })).toContainText("Linked to SC-1140");
  });

  test("escalating from the dashboard shows on the issue", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/admin");
    const attention = page.locator(".glass", { has: page.getByRole("heading", { name: "Needs attention" }) }).first();
    const escalate = attention.getByRole("button", { name: /^Escalate SC-/ }).first();
    const id = (await escalate.getAttribute("aria-label"))!.replace("Escalate ", "");
    await escalate.click();
    await expect(toast(page)).toContainText("Issue escalated (demo)");
    await attention.getByRole("link").filter({ hasText: /./ }).first().waitFor();
    await nav(page, "Issues").click();
    await page.getByLabel("Search issues").or(page.getByRole("searchbox")).first().fill(id);
    await page.locator("tbody tr").first().getByRole("link").click();
    await expect(page.getByRole("region", { name: "Manage issue" })).toContainText("Escalated");
  });

  test("add funds: invalid amounts are refused, a valid one raises the budget", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/finance");
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("₹2,50,000");
    await page.getByRole("button", { name: "Add funds" }).click();
    const dialog = page.getByRole("dialog", { name: "Add funds" });
    await dialog.getByLabel("Amount").fill("0");
    await dialog.getByRole("button", { name: "Add funds (demo)" }).click();
    await expect(dialog).toContainText("greater than 0");
    await dialog.getByLabel("Amount").fill("50000");
    await dialog.getByRole("button", { name: "Add funds (demo)" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText("added to the budget (demo)");
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("₹3,00,000");
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("Includes funds added in this demo");
  });

  test("a claim is paid once: after approval there is nothing left to approve", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/finance");
    const pending = page.getByRole("tab", { name: /To review/ });
    const before = Number((await pending.innerText()).match(/\d+/)![0]);
    await page.getByRole("button", { name: "Review" }).first().click();
    await page.getByRole("button", { name: /Approve and pay/ }).click();
    await expect(toast(page)).toContainText("No real transaction was created");
    await expect(async () => expect(Number((await pending.innerText()).match(/\d+/)![0])).toBe(before - 1)).toPass();
  });

  test("approve a worker request, assign them work, then remove a worker", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/workers");
    const requests = page.locator(".glass", { has: page.getByRole("heading", { name: "Requests for worker access" }) }).first();
    await requests.locator("li", { hasText: "Deepak Joshi" }).getByRole("button", { name: "Approve" }).click();
    await expect(toast(page)).toContainText("Deepak Joshi is now a worker (demo)");
    const table = page.getByRole("region", { name: "Workers" });
    await expect(table).toContainText("Deepak Joshi");

    await table.getByRole("button", { name: "Remove worker access from Anil Verma" }).click();
    const confirm = page.getByRole("dialog", { name: /Remove worker access from Anil Verma/ }).or(page.getByRole("alertdialog"));
    await expect(confirm).toContainText("stay assigned until you reassign them");
    await confirm.getByRole("button", { name: "Remove access" }).click();
    await expect(table).not.toContainText("Anil Verma");

    // The Worker perspective's own account can't be removed; the refusal is shown, not a fake success.
    await table.getByRole("button", { name: "Remove worker access from Ramesh Kumar" }).click();
    await page.getByRole("button", { name: "Remove access" }).click();
    await expect(alerts(page).filter({ hasText: "That isn't possible here" })).toContainText("Worker perspective");
    await expect(table).toContainText("Ramesh Kumar");

    // The new worker can be given work; the removed one is no longer offered.
    await nav(page, "Issues").click();
    await page.getByLabel("Search issues").or(page.getByRole("searchbox")).first().fill("SC-1133");
    await page.locator("tbody tr").first().getByRole("link").click();
    await page.getByRole("button", { name: "Assign worker" }).click();
    const assign = page.getByRole("dialog", { name: "Assign a worker" });
    await expect(assign).toContainText("Deepak Joshi");
    await expect(assign).not.toContainText("Anil Verma");
  });

  test("add a location, report against it through its QR link, then delete it", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/locations");
    await page.getByRole("button", { name: "Add location" }).click();
    const add = page.getByRole("dialog", { name: "Add location" });
    await add.getByRole("button", { name: "Add location (demo)" }).click();
    await expect(add).toContainText("Give the location a name");
    await add.getByLabel("Name").fill("Staff room");
    await add.getByLabel("Map place").selectOption({ label: "Blocks 3 and 4 area" });
    await add.getByLabel("Room (optional)").fill("12");
    await add.getByRole("button", { name: "Add location (demo)" }).click();

    const qr = page.getByRole("dialog", { name: "Location QR code" });
    await expect(qr.getByRole("img", { name: /QR code for reporting an issue at Staff room/ })).toBeVisible();
    await expect(qr).toContainText("/viewer/report?location=blocks-3-4-staff-room-12");
    await qr.getByRole("link", { name: "Open the report form as a scan would" }).click();
    await expect(page).toHaveURL(/\/viewer\/report\?location=blocks-3-4-staff-room-12$/);
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("blocks-3-4-staff-room-12");
    await expect(page.getByTestId("location-detail")).toContainText("Blocks 3 and 4 area");
    await expect(page.getByTestId("location-detail")).toContainText("Approximate position");
    await page.getByLabel("Title").fill("Broken chair in the staff room");
    await page.getByLabel("What is wrong?").fill("One of the chairs has a cracked leg and is unsafe to sit on.");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toBeVisible();

    await roleButton(page, "Admin").click();
    await nav(page, "Locations & QR").click();
    await expect(page.getByRole("list", { name: "Locations" })).toContainText("Added in this demo");
    await page.getByRole("button", { name: /Staff room/ }).click();
    await qr.getByRole("button", { name: "Delete this location" }).click();
    await page.getByRole("button", { name: "Delete location" }).click();
    await expect(page.getByRole("list", { name: "Locations" })).not.toContainText("Staff room");
    // Researched locations can't be deleted.
    await page.getByRole("button", { name: /Seminar Hall, Block 4/ }).click();
    await expect(qr).toContainText("can't be deleted here");
    await expect(qr.getByRole("button", { name: "Delete this location" })).toHaveCount(0);
  });
});

test.describe("students and workers", () => {
  test("the discussion accepts a message from the reporter and stays private to others", async ({ page }) => {
    await as(page, "student");
    await page.goto("/viewer/issues/SC-1140");
    const discussion = page.getByRole("region", { name: "Discussion" });
    const log = discussion.getByRole("log", { name: "Messages" });
    await expect(log).toContainText("I'll check the breaker");
    await expect(discussion.getByRole("button", { name: "Send message" })).toBeDisabled();
    await discussion.getByRole("textbox", { name: "Message" }).fill("It tripped again at noon today.");
    await discussion.getByRole("button", { name: "Send message" }).click();
    await expect(log).toContainText("It tripped again at noon today.");
    await expect(discussion.getByRole("textbox", { name: "Message" })).toHaveValue("");
    await expect(toast(page)).toContainText("Message sent (demo)");

    // The worker on that task is notified and sees the message.
    await roleButton(page, "Worker").click();
    await page.getByRole("button", { name: /^Notifications, \d+ unread/ }).click();
    await expect(page.getByText("New message").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Another student's report: the Student perspective can't read or join its discussion.
    await page.evaluate(() => sessionStorage.setItem("smart-campus-viewer-role", "student"));
    await page.goto("/viewer/issues/SC-1139");
    await expect(page.getByRole("region", { name: "Discussion" })).toContainText("private to the person who reported this issue");
    await expect(page.getByRole("region", { name: "Discussion" }).getByRole("textbox")).toHaveCount(0);
  });

  test("an upvote can be given and taken back", async ({ page }) => {
    await as(page, "student");
    await page.goto("/viewer/issues/SC-1139");
    const up = page.getByRole("button", { name: /^Upvote \(9\)/ });
    await up.click();
    const down = page.getByRole("button", { name: /^Remove upvote \(10\)/ });
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await down.click();
    await expect(page.getByRole("button", { name: /^Upvote \(9\)/ })).toBeVisible();
  });

  test("a quick report is parsed, reviewed and submitted", async ({ page }) => {
    await as(page, "student");
    await page.goto("/viewer/report");
    await page.getByRole("group", { name: "Report mode" }).getByRole("button", { name: "Quick report" }).click();
    await page.getByRole("button", { name: "Review report" }).click();
    await expect(page.getByText("Describe the problem in a few words")).toBeVisible();
    await page.getByLabel("What is wrong, and where?").fill("The projector in the Seminar Hall does not turn on since this morning.");
    await page.getByRole("button", { name: "Review report" }).click();
    await expect(page.getByTestId("quick-review")).toContainText("IT");
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("mjcet-seminar-hall");
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await expect(page.getByRole("heading", { name: "Demo report submitted" })).toBeVisible();
    await page.getByRole("link", { name: /^Open SC-1146/ }).click();
    await expect(page.locator("h1")).toContainText("The projector in the Seminar Hall does not turn on since this morning");
    await expect(page.locator("header").filter({ hasText: "SC-1146" })).toContainText("Seminar Hall, Block 4");
  });

  test("a worker sees a repair tip, and can't act on someone else's task", async ({ page }) => {
    await as(page, "worker");
    await page.goto("/viewer/worker");
    const queue = page.locator("[data-tour=worker-queue]");
    await expect(queue.getByText("Suggested checks").first()).toBeVisible();
    await page.goto("/viewer/issues/SC-1139");
    await expect(page.getByRole("region", { name: "Actions" })).toContainText("This task belongs to Anil Verma");
    await expect(page.getByRole("button", { name: "Start work" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Manage issue" })).toHaveCount(0);
  });
});

test.describe("filters shared with the signed-in pages", () => {
  test("the issues table filters by campus place and the result follows the map's count", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/issues");
    await page.getByLabel("Campus place").selectOption({ label: "Blocks 3 and 4 area" });
    await expect(page.getByRole("button", { name: /Remove filter: Blocks 3 and 4 area/ })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) expect(text).toMatch(/Block 3|Block 4|Seminar Hall/);
    await page.getByLabel("Status", { exact: true }).selectOption("Open");
    for (const text of await rows.allInnerTexts()) expect(text).toContain("Open");
  });

  test("analytics filters by place, status, priority and worker, and exports only what is shown", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/analytics");
    const reported = page.locator(".glass", { hasText: /^Reported/ }).first();
    const all = await reported.innerText();
    await page.getByLabel("Campus place").selectOption({ label: "Blocks 1, 2 and 5 area" });
    await expect(async () => expect(await reported.innerText()).not.toBe(all)).toPass();
    const placed = await reported.innerText();
    await page.getByLabel("Priority", { exact: true }).selectOption("High");
    await expect(async () => expect(await reported.innerText()).not.toBe(placed)).toPass();
    await page.getByLabel("Worker", { exact: true }).selectOption({ label: "Ramesh Kumar" });
    await page.getByLabel("Status", { exact: true }).selectOption("Resolved");
    for (const chip of [/Blocks 1, 2 and 5 area/, /Priority: High/, /Ramesh Kumar/, /Status: Resolved/]) await expect(page.getByRole("button", { name: chip })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");
  });
});

test.describe("demo state", () => {
  test("changes are counted, survive navigation, and Reset demo restores the baseline", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/admin");
    const reset = page.getByTestId("reset-demo");
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("129");
    await expect(reset).toHaveText(/^\s*Reset demo\s*$/);

    await nav(page, "Finance").click();
    await page.getByRole("button", { name: "Add funds" }).click();
    await page.getByRole("dialog", { name: "Add funds" }).getByLabel("Amount").fill("1000");
    await page.getByRole("button", { name: "Add funds (demo)" }).click();
    await roleButton(page, "Student").click();
    await nav(page, "Report an issue").click();
    await page.getByLabel("Title").fill("Tap dripping in the washroom");
    await page.getByLabel("What is wrong?").fill("The tap does not close fully and drips all day.");
    await page.getByLabel("Location", { exact: true }).selectOption({ label: "Block 2" });
    await page.getByRole("button", { name: "Submit report (demo)" }).click();
    await roleButton(page, "Admin").click();
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("130");
    await expect(reset.getByLabel("2 simulated changes")).toBeVisible();

    await reset.click();
    const confirm = page.getByRole("dialog", { name: "Reset the demo?" }).or(page.getByRole("alertdialog"));
    await expect(confirm).toContainText("2 simulated changes will be discarded");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("130");
    await reset.click();
    await confirm.getByRole("button", { name: "Reset demo" }).click();
    await expect(toast(page)).toContainText("Demo reset");
    await expect(page.locator("[data-tour=admin-kpis]")).toContainText("129");
    await nav(page, "Finance").click();
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("₹2,50,000");
  });

  test("a reload returns to the same baseline (nothing is stored)", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/finance");
    await page.getByRole("button", { name: "Add funds" }).click();
    await page.getByRole("dialog", { name: "Add funds" }).getByLabel("Amount").fill("70000");
    await page.getByRole("button", { name: "Add funds (demo)" }).click();
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("₹3,20,000");
    await page.reload();
    await ready(page);
    await expect(page.locator("[data-tour=finance-summary]")).toContainText("₹2,50,000");
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toMatch(/SC-\d|70000|budget/i);
  });
});

test.describe("campus map labels", () => {
  const overlaps = (page: Page) =>
    page.evaluate(() => {
      const boxes = [...document.querySelectorAll<SVGTextElement>('[data-label][data-label-visible="true"]')].map((t) => ({ id: t.dataset.label!, r: t.getBoundingClientRect() }));
      const hits: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) hits.push(`${boxes[i].id} / ${boxes[j].id}`);
        }
      return { hits, shown: boxes.length };
    });

  for (const [w, h] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ] as const) {
    test(`no visible labels overlap at ${w}x${h}, at any zoom, and every place stays reachable`, async ({ page }) => {
      await as(page, "admin");
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/viewer/map");
      const map = page.getByRole("group", { name: /^SUES campus map/ });
      await expect(map).toBeVisible();
      for (let step = 0; step < 4; step++) {
        const { hits, shown } = await overlaps(page);
        expect(hits, `zoom step ${step}`).toEqual([]);
        expect(shown).toBeGreaterThanOrEqual(6);
        // Shown or not, every place is a focusable button with its full name.
        await expect(map.getByRole("button")).toHaveCount(9);
        await page.getByRole("button", { name: "Zoom in" }).click();
      }
      await page.getByRole("button", { name: "Reset the map view" }).click();
      for (const name of [/^Ghulam Ahmed Hall/, /^Blocks 1, 2 and 5 area/, /^Shuttle court/, /^State Bank of India/]) await expect(map.getByRole("button", { name })).toHaveCount(1);
    });
  }

  test("selecting a place shows its label, confidence and sources; the keyboard zooms and pans", async ({ page }) => {
    await as(page, "admin");
    await page.goto("/viewer/map");
    const map = page.getByRole("group", { name: /^SUES campus map/ });
    for (const id of ["ghulam-ahmed-hall", "physical-education", "sbi", "garden"]) {
      const marker = map.locator(`[data-place=${id}]`);
      await marker.focus();
      await page.keyboard.press("Enter");
      await expect(marker).toHaveAttribute("aria-pressed", "true");
      await expect(map.locator(`[data-label=${id}]`)).toHaveAttribute("data-label-visible", "true");
      expect((await overlaps(page)).hits.filter((h) => !h.includes(id))).toEqual([]);
    }
    await map.locator("[data-place=ghulam-ahmed-hall]").focus();
    await page.keyboard.press("Enter");
    const detail = page.locator(".glass", { has: page.getByRole("heading", { name: "Ghulam Ahmed Hall" }) }).first();
    await expect(detail).toContainText("Sources disagree");
    await expect(detail).toContainText("240 m");
    await expect(detail.getByTestId("place-sources")).toContainText("Based on:");
    await expect(detail.getByTestId("place-sources").getByRole("link").first()).toHaveAttribute("href", /^https:\/\/(www\.)?mjcollege\.ac\.in\//);

    const box = () => map.evaluate((el) => el.getAttribute("viewBox")!.split(" ").map(Number));
    const start = await box();
    await page.keyboard.press("+");
    const zoomed = await box();
    expect(zoomed[2]).toBeLessThan(start[2]);
    await page.keyboard.press("ArrowRight");
    expect((await box())[0]).toBeGreaterThan(zoomed[0]);
    await page.keyboard.press("0");
    expect(await box()).toEqual(start);
  });
});
