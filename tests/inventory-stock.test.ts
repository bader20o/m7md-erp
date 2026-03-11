import assert from "node:assert/strict";
import test from "node:test";
import { computeStockQty, isStockChangeAllowed, resolveStockDelta } from "../lib/inventory";
import {
  getInventoryExpenseCategory,
  resolveMovementPricing,
  roundTotalCost,
  roundUnitCost
} from "../lib/inventory-movements";

test("IN and OUT deltas update stock quantity correctly", () => {
  const startQty = 10;
  const inDelta = resolveStockDelta("IN", 4);
  const afterIn = computeStockQty(startQty, inDelta);
  assert.equal(afterIn, 14);

  const outDelta = resolveStockDelta("OUT", 3);
  const afterOut = computeStockQty(afterIn, outDelta);
  assert.equal(afterOut, 11);
});

test("negative stock is always blocked", () => {
  const currentQty = 2;
  const outDelta = resolveStockDelta("OUT", 5);

  assert.equal(isStockChangeAllowed(currentQty, outDelta, "EMPLOYEE"), false);
  assert.equal(isStockChangeAllowed(currentQty, outDelta, "ADMIN"), false);
});

test("movement pricing resolves from unit cost with required rounding", () => {
  const pricing = resolveMovementPricing({
    quantity: 10,
    pricingMode: "UNIT",
    unitCost: 72
  });

  assert.equal(pricing.unitCost, 72);
  assert.equal(pricing.totalCost, 720);
  assert.equal(roundUnitCost(72.1239), 72.124);
  assert.equal(roundTotalCost(720.126), 720.13);
});

test("movement pricing resolves from total cost with reciprocal unit rounding", () => {
  const pricing = resolveMovementPricing({
    quantity: 10,
    pricingMode: "TOTAL",
    totalCost: 721
  });

  assert.equal(pricing.totalCost, 721);
  assert.equal(pricing.unitCost, 72.1);
});

test("inventory movement categories map to ledger expense categories", () => {
  assert.equal(getInventoryExpenseCategory("IN"), "INVENTORY_PURCHASE");
  assert.equal(getInventoryExpenseCategory("OUT"), "INVENTORY_ADJUSTMENT");
  assert.equal(getInventoryExpenseCategory("ADJUST"), "INVENTORY_ADJUSTMENT");
  assert.equal(getInventoryExpenseCategory("SALE"), null);
});
