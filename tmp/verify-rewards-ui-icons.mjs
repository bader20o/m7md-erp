import { chromium } from "playwright";

const baseURL = "http://localhost:3000";

async function login(page, phone, password) {
  const res = await page.request.post(`${baseURL}/api/auth/login`, { data: { phone, password } });
  if (!res.ok()) throw new Error(`login failed ${phone}: ${res.status()} ${await res.text()}`);
}

const browser = await chromium.launch({ headless: true });
const adminCtx = await browser.newContext({ baseURL });
const customerCtx = await browser.newContext({ baseURL });
const admin = await adminCtx.newPage();
const customer = await customerCtx.newPage();

try {
  await login(admin, "0780000000", "ChangeMe123!");

  const code = `ICON_${Date.now()}`;
  const create = await admin.request.post(`${baseURL}/api/admin/rewards`, {
    data: {
      code,
      title: `Icon Reward ${Date.now()}`,
      triggerType: "VISIT_COUNT",
      triggerValue: 3,
      rewardType: "CUSTOM_GIFT",
      customGiftText: "Air freshener",
      rewardIconUrl: "/uploads/services/1772926498341_529d3e79-9702-4401-993a-c17f494c40e8.jpg",
      periodDays: 7,
      isActive: true
    }
  });
  if (!create.ok()) throw new Error(`create failed: ${create.status()} ${await create.text()}`);

  await admin.goto("/admin/rewards", { waitUntil: "networkidle" });
  await admin.getByRole("heading", { name: "Rewards & Loyalty" }).waitFor({ timeout: 20000 });
  await admin.locator("#rewards-rules-body tr").filter({ hasText: "Icon Reward" }).first().waitFor({ timeout: 20000 });
  await admin.screenshot({ path: "tmp/rewards-admin-ui-icons.png", fullPage: true });

  await login(customer, "0791111100", "ChangeMe123!");
  const rewardsRes = await customer.request.get(`${baseURL}/api/customer/rewards`);
  if (!rewardsRes.ok()) throw new Error(`customer rewards failed: ${rewardsRes.status()} ${await rewardsRes.text()}`);
  const rewardsJson = await rewardsRes.json();
  const hasIconRule = (rewardsJson?.data?.activeRules || []).some((r) => r.rewardIconUrl);
  if (!hasIconRule) throw new Error("rewardIconUrl missing in customer payload");

  await customer.goto("/rewards", { waitUntil: "networkidle" });
  await customer.getByRole("heading", { name: "My Rewards" }).waitFor({ timeout: 20000 });
  await customer.locator("#rewards-summary").waitFor({ timeout: 20000 });
  await customer.screenshot({ path: "tmp/rewards-customer-ui-simplified.png", fullPage: true });

  console.log(JSON.stringify({ ok: true, code }));
} finally {
  await adminCtx.close();
  await customerCtx.close();
  await browser.close();
}
