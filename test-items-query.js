const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testItemsQuery() {
    console.log('=== Testing Items Query ===\n');

    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        // Simulate the exact query from the API
        const where = {
            AND: [
                {
                    OR: [
                        { ownerId: userId },
                        { shares: { some: { userId: userId } } }
                    ]
                }
            ]
        };

        console.log('Query WHERE clause:', JSON.stringify(where, null, 2));

        const items = await prisma.item.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                tags: { include: { tag: true } },
                shares: {
                    where: { userId: userId },
                    include: { sharedBy: { select: { name: true, email: true, image: true } } }
                },
                ranks: {
                    where: {
                        userId: userId,
                        contextId: "dashboard"
                    }
                }
            },
            take: 5
        });

        console.log(`\nFound ${items.length} items`);
        items.forEach((item, i) => {
            console.log(`${i + 1}. "${item.title || 'Untitled'}" (ID: ${item.id})`);
        });

    } catch (error) {
        console.error('Query Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testItemsQuery();
