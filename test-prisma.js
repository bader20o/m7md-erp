const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const parts = await prisma.part.findMany({
            orderBy: { name: 'asc' }
        });
        console.log('Successfully fetched', parts.length, 'parts.');
        console.log(parts);
    } catch (e) {
        console.error('Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
