import { chromium } from "playwright";

const baseURL = "http://localhost:3000";
const admin = { phone: "0780000000", password: "ChangeMe123!" };
const employee = { phone: "0781000103", password: "ChangeMe123!" };
const title = `PW Task ${Date.now()}`;

async function login(page, creds) {
  const response = await page.request.post(`${baseURL}/api/auth/login`, { data: creds });
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Login failed for ${creds.phone}: ${response.status()} ${text}`);
  }
}

async function logout(page) {
  await page.request.post(`${baseURL}/api/auth/logout`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await login(page, admin);
    await page.goto(`/admin/tasks`, { waitUntil: "networkidle" });

    await page.locator("#btn-create-task").click();
    await page.locator("#create-task-form select[name='assignedToId']").selectOption({ index: 1 });
    await page.getByPlaceholder("Task title").fill(title);
    await page.getByPlaceholder("Optional details...").fill("Playwright admin->employee task flow validation");
    await page.locator("#create-task-form button[type='submit']").click();

    const createdTaskBtn = page.locator("button").filter({ hasText: title }).first();
    await createdTaskBtn.waitFor({ state: "visible", timeout: 15000 });
    await page.screenshot({ path: "tmp/playwright-admin-task-created.png", fullPage: true });

    await logout(page);
    await login(page, employee);
    await page.goto(`/tasks`, { waitUntil: "networkidle" });

    const taskCard = page.locator("article").filter({ hasText: title }).first();
    await taskCard.waitFor({ state: "visible", timeout: 15000 });
    await taskCard.getByPlaceholder("Required note").fill("Completed by Playwright validation pass");
    await taskCard.getByRole("button", { name: /^Submit$/ }).click();

    await taskCard.locator("span", { hasText: "Done" }).first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: "tmp/playwright-employee-task-updated.png", fullPage: true });

    await logout(page);
    await login(page, admin);
    await page.goto(`/admin/tasks`, { waitUntil: "networkidle" });
    const adminTaskCard = page.locator("button").filter({ hasText: title }).first();
    await adminTaskCard.waitFor({ state: "visible", timeout: 15000 });
    await adminTaskCard.locator("span", { hasText: "Done" }).first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: "tmp/playwright-admin-task-verified.png", fullPage: true });

    console.log(JSON.stringify({ ok: true, title }));
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("PLAYWRIGHT_PASS_FAILED", error);
  process.exit(1);
});
