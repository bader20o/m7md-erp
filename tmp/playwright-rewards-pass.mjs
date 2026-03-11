import { chromium } from "playwright";

const baseURL = "http://localhost:3000";
const adminCreds = { phone: "0780000000", password: "ChangeMe123!" };
const customerCreds = { phone: "0791111100", password: "ChangeMe123!" };
const ts = Date.now();
const rewardCode = `PW_VISIT_${ts}`;
const rewardTitle = `PW Visit Reward ${ts}`;

async function login(page, creds) {
  const res = await page.request.post(`${baseURL}/api/auth/login`, { data: creds });
  if (!res.ok()) {
    throw new Error(`Login failed ${creds.phone}: ${res.status()} ${await res.text()}`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const adminCtx = await browser.newContext({ baseURL });
  const customerCtx = await browser.newContext({ baseURL });
  const adminPage = await adminCtx.newPage();
  const customerPage = await customerCtx.newPage();

  try {
    await login(adminPage, adminCreds);
    await adminPage.goto("/admin/rewards", { waitUntil: "networkidle" });
    await adminPage.getByRole("heading", { name: "Rewards & Loyalty" }).waitFor({ timeout: 20000 });

    const qrImage = adminPage.locator("#visit-qr-image");
    await qrImage.waitFor({ state: "visible", timeout: 20000 });
    await adminPage.waitForFunction(() => {
      const img = document.querySelector("#visit-qr-image");
      return !!img && img.getAttribute("src")?.startsWith("data:image/");
    });

    await adminPage.locator("#reward-rule-form input[name='code']").fill(rewardCode);
    await adminPage.locator("#reward-rule-form input[name='title']").fill(rewardTitle);
    await adminPage.locator("#reward-rule-form input[name='triggerValue']").fill("2");
    await adminPage.locator("#reward-rule-form select[name='rewardType']").selectOption("CUSTOM_GIFT");
    await adminPage.locator("#reward-rule-form input[name='customGiftText']").fill("Free microfiber cloth");
    await adminPage.locator("#reward-rule-form button[type='submit']").click();

    await adminPage.locator("#rewards-rules-body tr").filter({ hasText: rewardTitle }).first().waitFor({ timeout: 20000 });
    await adminPage.screenshot({ path: "tmp/playwright-rewards-admin.png", fullPage: true });

    const qrRes1 = await adminPage.request.get(`${baseURL}/api/admin/rewards/visit-qr`);
    if (!qrRes1.ok()) throw new Error(`visit-qr failed: ${qrRes1.status()} ${await qrRes1.text()}`);
    const qrJson1 = await qrRes1.json();
    const token1 = qrJson1?.data?.token;
    if (!token1) throw new Error("Missing QR token from visit-qr endpoint");

    await login(customerPage, customerCreds);

    const rewardsBefore = await customerPage.request.get(`${baseURL}/api/customer/rewards`);
    if (!rewardsBefore.ok()) throw new Error(`customer rewards failed: ${rewardsBefore.status()} ${await rewardsBefore.text()}`);
    const rewardsBeforeJson = await rewardsBefore.json();
    if (!Array.isArray(rewardsBeforeJson?.data?.activeRules)) {
      throw new Error("customer rewards payload missing activeRules");
    }

    const checkin1 = await customerPage.request.post(`${baseURL}/api/customer/visits/check-in`, {
      data: { token: token1 }
    });
    if (!checkin1.ok()) throw new Error(`check-in #1 failed: ${checkin1.status()} ${await checkin1.text()}`);
    const checkinJson1 = await checkin1.json();
    if (!checkinJson1?.data?.success) {
      throw new Error(`check-in #1 expected success, got ${JSON.stringify(checkinJson1)}`);
    }

    const qrRes2 = await adminPage.request.get(`${baseURL}/api/admin/rewards/visit-qr`);
    if (!qrRes2.ok()) throw new Error(`visit-qr #2 failed: ${qrRes2.status()} ${await qrRes2.text()}`);
    const qrJson2 = await qrRes2.json();
    const token2 = qrJson2?.data?.token;
    if (!token2) throw new Error("Missing second QR token");

    const checkin2 = await customerPage.request.post(`${baseURL}/api/customer/visits/check-in`, {
      data: { token: token2 }
    });
    if (!checkin2.ok()) throw new Error(`check-in #2 failed: ${checkin2.status()} ${await checkin2.text()}`);
    const checkinJson2 = await checkin2.json();
    if (!checkinJson2?.data?.alreadyRegistered) {
      throw new Error(`check-in #2 expected alreadyRegistered=true, got ${JSON.stringify(checkinJson2)}`);
    }

    const rewardsAfter = await customerPage.request.get(`${baseURL}/api/customer/rewards`);
    if (!rewardsAfter.ok()) throw new Error(`customer rewards after failed: ${rewardsAfter.status()} ${await rewardsAfter.text()}`);
    const rewardsAfterJson = await rewardsAfter.json();
    const createdRule = (rewardsAfterJson?.data?.activeRules || []).find((r) => r.title === rewardTitle);
    if (!createdRule) {
      throw new Error("Created reward rule missing from customer activeRules");
    }
    if (Number(createdRule.progressValue) < 1) {
      throw new Error(`Expected progress >=1 after check-in, got ${createdRule.progressValue}`);
    }

    await customerPage.goto("/rewards", { waitUntil: "networkidle" });
    await customerPage.getByRole("heading", { name: "My Rewards" }).waitFor({ timeout: 20000 });
    await customerPage.locator("#rewards-offered article").filter({ hasText: rewardTitle }).first().waitFor({ timeout: 20000 });
    await customerPage.screenshot({ path: "tmp/playwright-rewards-customer.png", fullPage: true });

    console.log(JSON.stringify({ ok: true, rewardCode, rewardTitle }));
  } finally {
    await adminCtx.close();
    await customerCtx.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("PLAYWRIGHT_REWARDS_FAILED", error);
  process.exit(1);
});
