import { prisma } from './lib/prisma.mjs';

async function debug() {
    console.log('=== Database Debug ===\n');

    // Count items
    const itemCount = await prisma.item.count();
    console.log(`Total items in DB: ${itemCount}`);

    // Get all users
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    });
    console.log(`\nUsers (${users.length}):`);
    users.forEach(u => console.log(`  - ${u.email} (ID: ${u.id})`));

    // Get items grouped by owner
    const items = await prisma.item.findMany({
        select: { id: true, title: true, ownerId: true },
        take: 10
    });
    console.log(`\nFirst 10 items:`);
    items.forEach(i => console.log(`  - "${i.title}" (Owner: ${i.ownerId})`));

    // Check for items with each user
    for (const user of users) {
        const userItems = await prisma.item.count({
            where: { ownerId: user.id }
        });
        console.log(`\n${user.email} owns ${userItems} items`);
    }

    await prisma.$disconnect();
}

debug().catch(console.error);
