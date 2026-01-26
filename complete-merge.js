const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeAccountMerge() {
    console.log('=== Completing Account Merge ===\n');

    const oldUserId = 'cmkkiuk8y0000uu36w7xb0erm'; // phil.reed@gmail.com (lowercase)
    const newUserId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com (uppercase)

    try {
        // Transfer any remaining item ranks
        const rankCount = await prisma.itemRank.count({ where: { userId: oldUserId } });
        if (rankCount > 0) {
            const rankResult = await prisma.itemRank.updateMany({
                where: { userId: oldUserId },
                data: { userId: newUserId }
            });
            console.log(`✓ Transferred ${rankResult.count} item ranks`);
        } else {
            console.log('✓ No item ranks to transfer');
        }

        // Transfer any shared items
        const sharedItemCount = await prisma.sharedItem.count({ where: { userId: oldUserId } });
        if (sharedItemCount > 0) {
            const sharedResult = await prisma.sharedItem.updateMany({
                where: { userId: oldUserId },
                data: { userId: newUserId }
            });
            console.log(`✓ Transferred ${sharedResult.count} shared items`);
        } else {
            console.log('✓ No shared items to transfer');
        }

        // Transfer any shared lists
        const sharedListCount = await prisma.sharedList.count({ where: { userId: oldUserId } });
        if (sharedListCount > 0) {
            const sharedListResult = await prisma.sharedList.updateMany({
                where: { userId: oldUserId },
                data: { userId: newUserId }
            });
            console.log(`✓ Transferred ${sharedListResult.count} shared lists`);
        } else {
            console.log('✓ No shared lists to transfer');
        }

        // Check if old user still has any data
        const remainingItems = await prisma.item.count({ where: { ownerId: oldUserId } });
        const remainingLists = await prisma.list.count({ where: { ownerId: oldUserId } });

        console.log(`\nRemaining data on old account:`);
        console.log(`  - Items: ${remainingItems}`);
        console.log(`  - Lists: ${remainingLists}`);

        if (remainingItems === 0 && remainingLists === 0) {
            // Safe to delete old user
            await prisma.user.delete({ where: { id: oldUserId } });
            console.log(`\n✅ Deleted old account (ID: ${oldUserId})`);
            console.log('Account merge complete!');
        } else {
            console.log('\n⚠️  Old account still has data, not deleting');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

completeAccountMerge();
