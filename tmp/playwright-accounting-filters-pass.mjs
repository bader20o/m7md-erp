import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = "http://localhost:3000";
const adminCreds = { phone: "0780000000", password: "ChangeMe123!" };

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function login(page, creds) {
  const response = await page.request.post(`${baseURL}/api/auth/login`, { data: creds });
  if (!response.ok()) {
    throw new Error(`Login failed ${creds.phone}: ${response.status()} ${await response.text()}`);
  }
}

async function waitForLedgerReady(page) {
  await page.locator("#tx-results-summary").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#tx-tbody tr").first().waitFor({ state: "visible", timeout: 20000 });
}

async function getSummaryCount(page) {
  const text = (await page.locator("#tx-results-summary").innerText()).trim();
  const match = text.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

async function getProfitPointCount(page) {
  await page.locator("#chart-profit-trend-ledger").waitFor({ state: "visible", timeout: 20000 });
  return page.locator("#chart-profit-trend-ledger svg circle").count();
}

async function setDateFilter(page, id, ymd) {
  const locator = page.locator(`#${id}`);
  await locator.waitFor({ state: "attached", timeout: 20000 });
  const type = await locator.getAttribute("type");
  if (type === "hidden") {
    await page.evaluate(
      ({ targetId, value }) => {
        const input = document.getElementById(targetId);
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { targetId: id, value: ymd }
    );
    return;
  }
  await locator.fill(ymd);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await login(page, adminCreds);
    await page.goto("/admin/accounting", { waitUntil: "networkidle" });
    await waitForLedgerReady(page);

    const baselineCount = await getSummaryCount(page);
    assert.notEqual(baselineCount, null, "Could not parse baseline summary count");

    await page.locator("#tx-filter-type").selectOption("EXPENSE");
    await page.waitForTimeout(250);
    const expenseCount = await getSummaryCount(page);
    assert.notEqual(expenseCount, null, "Could not parse expense-filter summary count");
    assert.ok(
      expenseCount <= baselineCount,
      `Expense filter should not increase rows (${expenseCount} > ${baselineCount})`
    );

    const today = toYmd(new Date());
    await setDateFilter(page, "tx-filter-from-date", today);
    await setDateFilter(page, "tx-filter-to-date", today);
    await page.waitForTimeout(300);
    const dateScopedCount = await getSummaryCount(page);
    assert.notEqual(dateScopedCount, null, "Could not parse date-scoped summary count");

    await page.locator("#tx-clear-filters").click();
    await page.waitForTimeout(350);
    const restoredCount = await getSummaryCount(page);
    assert.equal(restoredCount, baselineCount, "Clear filters did not restore baseline row count");

    await page.locator("#profit-trend-range-filter").selectOption("ALL");
    await page.waitForTimeout(300);
    const pointsAllBaseline = await getProfitPointCount(page);

    await page.locator("#profit-trend-range-filter").selectOption("7D");
    await page.waitForTimeout(300);
    const points7d = await getProfitPointCount(page);
    assert.ok(
      points7d <= Math.max(1, pointsAllBaseline),
      `Profit trend 7D points should not exceed ALL points (${points7d} > ${pointsAllBaseline})`
    );
    if (pointsAllBaseline > 7) {
      assert.equal(points7d, 7, `Expected 7 points for 7D range, got ${points7d}`);
    }

    await page.locator("#profit-trend-range-filter").selectOption("ALL");
    await page.waitForTimeout(300);
    const pointsAll = await getProfitPointCount(page);
    assert.equal(pointsAll, pointsAllBaseline, "Profit trend ALL range did not restore baseline points");

    await page.screenshot({ path: "tmp/playwright-accounting-filters.png", fullPage: true });
    console.log(
      JSON.stringify({
        ok: true,
        baselineCount,
        expenseCount,
        dateScopedCount,
        restoredCount,
        pointsAllBaseline,
        points7d,
        pointsAll
      })
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("PLAYWRIGHT_ACCOUNTING_FILTERS_FAILED", error);
  process.exit(1);
});
