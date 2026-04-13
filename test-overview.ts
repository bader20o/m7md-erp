import { getAnalyticsOverview } from "./lib/analytics/overview";

async function run() {
  console.log("Starting getAnalyticsOverview test...");
  try {
    const data = await getAnalyticsOverview({
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-04-01T23:59:59.999Z"),
      groupBy: "day"
    });
    console.log("Success! Data keys:", JSON.stringify(Object.keys(data)));
  } catch(e) {
    console.error("FAILED with error:");
    console.error(e);
  }
  process.exit(0);
}

run();
