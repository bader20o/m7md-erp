/**
 * Integration tests for ERP/POS-grade invoice ↔ inventory service.
 *
 * These tests exercise the pure service layer (createSaleInvoice,
 * updateSaleInvoice, voidSaleInvoice) against a real SQLite database
 * to verify atomicity, stock correctness, and idempotency.
 *
 * Run: npx tsx --test tests/invoice-integration.test.ts
 */

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { PrismaClient, InvoiceType, StockMovementType } from "@prisma/client";
import {
    createSaleInvoice,
    updateSaleInvoice,
    voidSaleInvoice,
} from "../lib/invoice-integration";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────

let counter = 0;
function uid(): string {
    return `test-${Date.now()}-${++counter}`;
}

async function createTestUser(): Promise<string> {
    const user = await prisma.user.create({
        data: {
            phone: `+1555${Date.now()}${counter}`,
            passwordHash: "test-hash",
            role: "ADMIN",
            fullName: "Test Admin",
        },
    });
    return user.id;
}

async function createTestPart(
    overrides: Partial<{
        name: string;
        stockQty: number;
        costPrice: number;
        sellPrice: number;
    }> = {}
) {
    return prisma.part.create({
        data: {
            name: overrides.name ?? `Part-${uid()}`,
            unit: "pcs",
            stockQty: overrides.stockQty ?? 100,
            costPrice: overrides.costPrice ?? 5.0,
            sellPrice: overrides.sellPrice ?? 10.0,
        },
    });
}

// Clean up test data after each test
afterEach(async () => {
    // Order matters due to foreign keys
    await prisma.customerAccountEntry.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.invoiceLine.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.part.deleteMany({});
    await prisma.user.deleteMany({});
});

// ── Tests ──────────────────────────────────────────────────────────────

test("creates sale invoice and deducts stock correctly", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 50, costPrice: 3.0 });

    const result = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Oil filter",
                    quantity: 5,
                    unitAmount: 10.0,
                },
            ],
        },
        actorId
    );

    // Invoice created
    assert.equal(result.invoice.type, InvoiceType.SALE);
    assert.equal(Number(result.invoice.totalAmount), 50.0);

    // Stock deducted
    const updatedPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(updatedPart!.stockQty, 45);

    // Stock movement created
    const movements = await prisma.stockMovement.findMany({
        where: { invoiceId: result.invoice.id },
    });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, StockMovementType.SALE);
    assert.equal(movements[0].quantity, 5);

    // Transaction created
    assert.ok(result.transaction);
    assert.equal(result.transaction.type, "INCOME");
    assert.equal(result.transaction.incomeSource, "INVOICE");
    assert.equal(Number(result.transaction.amount), 50.0);

    // Cost snapshot captured for profit reporting
    assert.equal(Number(result.lines[0].costSnapshot), 3.0);
});

test("rejects invoice when stock is insufficient", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 3 });

    await assert.rejects(
        () =>
            createSaleInvoice(
                {
                    number: `INV-${uid()}`,
                    lines: [
                        {
                            partId: part.id,
                            lineType: "INVENTORY",
                            description: "Brake pad",
                            quantity: 10,
                            unitAmount: 15.0,
                        },
                    ],
                },
                actorId
            ),
        (error: Error) => {
            assert.ok(error.message.includes("Insufficient stock"));
            return true;
        }
    );

    // Stock unchanged (atomic rollback)
    const updatedPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(updatedPart!.stockQty, 3);
});

test("outside-inventory lines do NOT touch stock", async () => {
    const actorId = await createTestUser();

    const result = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    lineType: "OUTSIDE",
                    description: "Custom labor work",
                    quantity: 1,
                    unitAmount: 200.0,
                },
            ],
        },
        actorId
    );

    // Invoice created
    assert.equal(Number(result.invoice.totalAmount), 200.0);

    // No stock movements
    const movements = await prisma.stockMovement.findMany({
        where: { invoiceId: result.invoice.id },
    });
    assert.equal(movements.length, 0);

    // Transaction still created
    assert.ok(result.transaction);
    assert.equal(Number(result.transaction.amount), 200.0);
});

test("SERVICE lines do NOT touch stock", async () => {
    const actorId = await createTestUser();

    const result = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    lineType: "SERVICE",
                    description: "Diagnostic scan",
                    quantity: 1,
                    unitAmount: 50.0,
                },
            ],
        },
        actorId
    );

    assert.equal(Number(result.invoice.totalAmount), 50.0);

    const movements = await prisma.stockMovement.findMany({
        where: { invoiceId: result.invoice.id },
    });
    assert.equal(movements.length, 0);
});

test("mixed lines: INVENTORY + OUTSIDE in same invoice", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 20, costPrice: 2.5 });

    const result = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Spark plug",
                    quantity: 4,
                    unitAmount: 8.0,
                },
                {
                    lineType: "OUTSIDE",
                    description: "Installation fee",
                    quantity: 1,
                    unitAmount: 25.0,
                },
            ],
        },
        actorId
    );

    // Total = 4*8 + 1*25 = 57
    assert.equal(Number(result.invoice.totalAmount), 57.0);

    // Only inventory part stock affected
    const updatedPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(updatedPart!.stockQty, 16);

    // Only 1 stock movement (for the inventory line)
    const movements = await prisma.stockMovement.findMany({
        where: { invoiceId: result.invoice.id },
    });
    assert.equal(movements.length, 1);
});

test("update invoice recomputes stock delta correctly", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 50 });

    // Create with qty 10
    const created = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Oil filter",
                    quantity: 10,
                    unitAmount: 10.0,
                },
            ],
        },
        actorId
    );

    let currentPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(currentPart!.stockQty, 40); // 50 - 10

    // Update to qty 7 (should restore 3)
    await updateSaleInvoice(
        created.invoice.id,
        {
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Oil filter",
                    quantity: 7,
                    unitAmount: 12.0,
                },
            ],
        },
        actorId
    );

    currentPart = await prisma.part.findUnique({ where: { id: part.id } });
    assert.equal(currentPart!.stockQty, 43); // 50 - 7

    // Transaction amount updated
    const txn = await prisma.transaction.findFirst({
        where: { invoiceId: created.invoice.id },
    });
    assert.equal(Number(txn!.amount), 84.0); // 7 * 12
});

test("update invoice: increase qty checks stock correctly", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 15 });

    const created = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Air filter",
                    quantity: 10,
                    unitAmount: 5.0,
                },
            ],
        },
        actorId
    );

    // Stock is now 5. Try to update to qty 20 (needs 20 total, only 15 available after restore)
    // After restore: 5 + 10 = 15. Need 20. Should fail.
    await assert.rejects(
        () =>
            updateSaleInvoice(
                created.invoice.id,
                {
                    lines: [
                        {
                            partId: part.id,
                            lineType: "INVENTORY",
                            description: "Air filter",
                            quantity: 20,
                            unitAmount: 5.0,
                        },
                    ],
                },
                actorId
            ),
        (error: Error) => {
            assert.ok(error.message.includes("Insufficient stock"));
            return true;
        }
    );
});

test("void invoice restores stock and soft-deletes transaction", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 30 });

    const created = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: "Coolant",
                    quantity: 8,
                    unitAmount: 7.0,
                },
            ],
        },
        actorId
    );

    let currentPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(currentPart!.stockQty, 22);

    await voidSaleInvoice(created.invoice.id, actorId);

    // Stock fully restored
    currentPart = await prisma.part.findUnique({ where: { id: part.id } });
    assert.equal(currentPart!.stockQty, 30);

    // No stock movements remain
    const movements = await prisma.stockMovement.findMany({
        where: { invoiceId: created.invoice.id },
    });
    assert.equal(movements.length, 0);

    // Transaction soft-deleted
    const txn = await prisma.transaction.findFirst({
        where: { referenceType: "INVOICE", referenceId: created.invoice.id },
    });
    assert.ok(txn);
    assert.equal(txn!.invoiceId, null);
    assert.notEqual(txn!.deletedAt, null);

    // Invoice is VOID
    const invoice = await prisma.invoice.findUnique({
        where: { id: created.invoice.id },
    });
    assert.equal(invoice!.status, "VOID");
});

test("voiding an already voided invoice is rejected", async () => {
    const actorId = await createTestUser();

    const created = await createSaleInvoice(
        {
            number: `INV-${uid()}`,
            lines: [
                {
                    lineType: "OUTSIDE",
                    description: "Misc charge",
                    quantity: 1,
                    unitAmount: 10.0,
                },
            ],
        },
        actorId
    );

    await voidSaleInvoice(created.invoice.id, actorId);

    await assert.rejects(
        () => voidSaleInvoice(created.invoice.id, actorId),
        (error: Error) => {
            assert.ok(error.message.includes("already voided"));
            return true;
        }
    );
});

test("duplicate invoice number is rejected", async () => {
    const actorId = await createTestUser();
    const invoiceNumber = `INV-DUPE-${uid()}`;

    await createSaleInvoice(
        {
            number: invoiceNumber,
            lines: [
                {
                    lineType: "OUTSIDE",
                    description: "Item A",
                    quantity: 1,
                    unitAmount: 10.0,
                },
            ],
        },
        actorId
    );

    await assert.rejects(
        () =>
            createSaleInvoice(
                {
                    number: invoiceNumber,
                    lines: [
                        {
                            lineType: "OUTSIDE",
                            description: "Item B",
                            quantity: 1,
                            unitAmount: 20.0,
                        },
                    ],
                },
                actorId
            )
    );
});

test("price varies freely across invoices for same part", async () => {
    const actorId = await createTestUser();
    const part = await createTestPart({ stockQty: 100, sellPrice: 10 });

    // Sell at 10
    const inv1 = await createSaleInvoice(
        {
            number: `INV-P1-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: part.name,
                    quantity: 2,
                    unitAmount: 10.0,
                },
            ],
        },
        actorId
    );

    // Sell same part at 13
    const inv2 = await createSaleInvoice(
        {
            number: `INV-P2-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: part.name,
                    quantity: 3,
                    unitAmount: 13.0,
                },
            ],
        },
        actorId
    );

    // Sell same part at 5
    const inv3 = await createSaleInvoice(
        {
            number: `INV-P3-${uid()}`,
            lines: [
                {
                    partId: part.id,
                    lineType: "INVENTORY",
                    description: part.name,
                    quantity: 1,
                    unitAmount: 5.0,
                },
            ],
        },
        actorId
    );

    // Each invoice has its own price
    assert.equal(Number(inv1.invoice.totalAmount), 20.0); // 2 * 10
    assert.equal(Number(inv2.invoice.totalAmount), 39.0); // 3 * 13
    assert.equal(Number(inv3.invoice.totalAmount), 5.0); // 1 * 5

    // Stock: 100 - 2 - 3 - 1 = 94
    const currentPart = await prisma.part.findUnique({
        where: { id: part.id },
    });
    assert.equal(currentPart!.stockQty, 94);
});

test("INVENTORY line without partId is rejected", async () => {
    const actorId = await createTestUser();

    await assert.rejects(
        () =>
            createSaleInvoice(
                {
                    number: `INV-${uid()}`,
                    lines: [
                        {
                            lineType: "INVENTORY",
                            description: "Something",
                            quantity: 1,
                            unitAmount: 5.0,
                        },
                    ],
                },
                actorId
            ),
        (error: Error) => {
            assert.ok(error.message.includes("partId"));
            return true;
        }
    );
});

test("empty lines array is rejected", async () => {
    const actorId = await createTestUser();

    await assert.rejects(
        () =>
            createSaleInvoice(
                {
                    number: `INV-${uid()}`,
                    lines: [],
                },
                actorId
            ),
        (error: Error) => {
            assert.ok(error.message.includes("at least one line"));
            return true;
        }
    );
});
