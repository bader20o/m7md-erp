import assert from "node:assert/strict";
import test from "node:test";
import { computeStockQty, isStockChangeAllowed, resolveStockDelta } from "../lib/inventory";

test("IN and OUT deltas update stock quantity correctly", () => {
  const startQty = 10;
  const inDelta = resolveStockDelta("IN", 4);
  const afterIn = computeStockQty(startQty, inDelta);
  assert.equal(afterIn, 14);

  const outDelta = resolveStockDelta("OUT", 3);
  const afterOut = computeStockQty(afterIn, outDelta);
  assert.equal(afterOut, 11);
});

test("negative stock is blocked for non-admin and allowed for admin override", () => {
  const currentQty = 2;
  const outDelta = resolveStockDelta("OUT", 5);

  assert.equal(isStockChangeAllowed(currentQty, outDelta, "MANAGER"), false);
  assert.equal(isStockChangeAllowed(currentQty, outDelta, "ADMIN"), true);
});
