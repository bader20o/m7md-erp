import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProfitTrendRangeToSeries,
  filterTransactionsByState
} from "../frontend/src/pages/admin/accounting.logic.js";

const seedTransactions = [
  {
    id: "1",
    occurredAt: "2026-03-01T10:00:00.000Z",
    type: "INCOME",
    amount: 100,
    itemName: "Walk-in Wash",
    note: "cash",
    sourceBucket: "WALK_IN"
  },
  {
    id: "2",
    occurredAt: "2026-03-02T10:00:00.000Z",
    type: "EXPENSE",
    amount: 40,
    itemName: "Supplies",
    note: "inventory",
    sourceBucket: "EXPENSE"
  },
  {
    id: "3",
    occurredAt: "2026-03-03T10:00:00.000Z",
    type: "INCOME",
    amount: 180,
    itemName: "Booking Service",
    note: "booking",
    sourceBucket: "BOOKING"
  },
  {
    id: "4",
    occurredAt: "2026-03-04T10:00:00.000Z",
    type: "INCOME",
    amount: 220,
    itemName: "Inventory Sale",
    note: "invoice",
    sourceBucket: "INVENTORY"
  }
];

test("filters by date range inclusively", () => {
  const result = filterTransactionsByState(seedTransactions, {
    q: "",
    type: "ALL",
    sellingType: "ALL",
    fromDate: "2026-03-02",
    toDate: "2026-03-03",
    sort: "NEWEST"
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["3", "2"]
  );
});

test("filters by type and source bucket", () => {
  const result = filterTransactionsByState(
    seedTransactions,
    {
      q: "",
      type: "INCOME",
      sellingType: "INVENTORY",
      fromDate: "",
      toDate: "",
      sort: "NEWEST"
    },
    { getSellingBucket: (tx) => tx.sourceBucket }
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "4");
});

test("applies search text and amount sorting", () => {
  const result = filterTransactionsByState(
    seedTransactions,
    {
      q: "service",
      type: "ALL",
      sellingType: "ALL",
      fromDate: "",
      toDate: "",
      sort: "AMOUNT_HIGH"
    },
    {
      getSellingBucket: (tx) => tx.sourceBucket,
      buildSearchBlob: (tx) => `${tx.itemName} ${tx.note}`.toLowerCase()
    }
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ["3"]
  );
});

test("applies trend range slicing", () => {
  const series = Array.from({ length: 40 }, (_, index) => ({
    day: index + 1,
    profit: index
  }));

  assert.equal(applyProfitTrendRangeToSeries(series, "ALL").length, 40);
  assert.equal(applyProfitTrendRangeToSeries(series, "7D").length, 7);
  assert.equal(applyProfitTrendRangeToSeries(series, "30D").length, 30);
  assert.equal(applyProfitTrendRangeToSeries(series, "90D").length, 40);
});
