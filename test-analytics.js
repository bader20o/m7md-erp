const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting analytics test...");
    try {
        const fromStart = new Date('2026-02-01T00:00:00.000Z');
        const toEnd = new Date('2026-04-01T23:59:59.999Z');
        const todayStart = new Date();
        todayStart.setUTCHours(0,0,0,0);
        const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

        console.log("Running aggregate transaction test...");
        const res = await prisma.transaction.aggregate({
            where: {
                type: 'INCOME',
                incomeSource: 'MEMBERSHIP',
                deletedAt: null,
                occurredAt: { gte: fromStart, lte: toEnd }
            },
            _sum: { amount: true }
        });
        console.log("Success trans", res);

        console.log("Running booking group by test...");
        const res2 = await prisma.booking.groupBy({
            by: ["serviceNameSnapshotEn", "serviceNameSnapshotAr"],
            where: {
                status: 'COMPLETED',
                finalPrice: { not: null },
                completedAt: { gte: fromStart, lte: toEnd }
            },
            _count: { _all: true },
            _sum: { finalPrice: true },
            orderBy: { _sum: { finalPrice: "desc" } },
            take: 10
        });
        console.log("Success group by", res2.length);

        console.log("Running stock movement aggregate...");
        const res3 = await prisma.stockMovement.aggregate({
            where: {
                occurredAt: {
                    gte: todayStart,
                    lte: todayEnd
                },
                OR: [
                    { type: 'SALE' },
                    {
                        type: 'OUT',
                        note: { contains: "sold" }
                    }
                ]
            },
            _sum: { quantity: true }
        });
        console.log("Success SM", res3);
        
    } catch (e) {
        console.error("ERROR CAUGHT:");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
