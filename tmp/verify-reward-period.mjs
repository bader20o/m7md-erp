import { chromium } from "playwright";

const baseURL = "http://localhost:3000";
const adminCreds = { phone: "0780000000", password: "ChangeMe123!" };
const customerCreds = { phone: "0791111100", password: "ChangeMe123!" };

async function login(page, creds) {
  const res = await page.request.post(`${baseURL}/api/auth/login`, { data: creds });
  if (!res.ok()) throw new Error(`login failed ${res.status()} ${await res.text()}`);
}

const browser = await chromium.launch({ headless: true });
const adminCtx = await browser.newContext({ baseURL });
const customerCtx = await browser.newContext({ baseURL });
const admin = await adminCtx.newPage();
const customer = await customerCtx.newPage();

try {
  await login(admin, adminCreds);

  const code = `PERIOD_${Date.now()}`;
  const create = await admin.request.post(`${baseURL}/api/admin/rewards`, {
    data: {
      code,
      title: `Period Rule ${Date.now()}`,
      triggerType: "VISIT_COUNT",
      triggerValue: 2,
      rewardType: "CUSTOM_GIFT",
      customGiftText: "Gift",
      periodDays: 7,
      isActive: true
    }
  });
  if (!create.ok()) throw new Error(`create failed ${create.status()} ${await create.text()}`);
  const createJson = await create.json();
  if (createJson?.data?.item?.periodDays !== 7) throw new Error(`periodDays not persisted: ${JSON.stringify(createJson)}`);

  await login(customer, customerCreds);
  const rewards = await customer.request.get(`${baseURL}/api/customer/rewards`);
  if (!rewards.ok()) throw new Error(`customer rewards failed ${rewards.status()} ${await rewards.text()}`);
  const rewardsJson = await rewards.json();
  const found = rewardsJson?.data?.activeRules?.find((r) => r.code === code || r.title?.includes("Period Rule"));
  if (!found) throw new Error("new period rule not visible in customer payload");
  if (found.periodDays !== 7) throw new Error(`customer payload periodDays mismatch: ${JSON.stringify(found)}`);

  console.log(JSON.stringify({ ok: true, code, periodDays: found.periodDays }));
} finally {
  await adminCtx.close();
  await customerCtx.close();
  await browser.close();
}
