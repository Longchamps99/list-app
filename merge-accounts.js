const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeAccounts() {
    console.log('=== Merging Duplicate Accounts ===\n');

    const oldEmail = 'phil.reed@gmail.com'; // lowercase - has items
    const newEmail = 'Phil.reed@gmail.com'; // uppercase - current login

    try {
        // Get both users
        const oldUser = await prisma.user.findUnique({ where: { email: oldEmail } });
        const newUser = await prisma.user.findUnique({ where: { email: newEmail } });

        if (!oldUser || !newUser) {
            console.error('Could not find both users!');
            return;
        }

        console.log(`Old account: ${oldUser.email} (ID: ${oldUser.id})`);
        console.log(`New account: ${newUser.email} (ID: ${newUser.id})`);

        // Count items to transfer
        const itemCount = await prisma.item.count({ where: { ownerId: oldUser.id } });
        console.log(`\nTransferring ${itemCount} items...`);

        // Transfer all items
        const updateResult = await prisma.item.updateMany({
            where: { ownerId: oldUser.id },
            data: { ownerId: newUser.id }
        });
        console.log(`✓ Transferred ${updateResult.count} items`);

        // Transfer all lists
        const listCount = await prisma.list.count({ where: { ownerId: oldUser.id } });
        if (listCount > 0) {
            const listResult = await prisma.list.updateMany({
                where: { ownerId: oldUser.id },
                data: { ownerId: newUser.id }
            });
            console.log(`✓ Transferred ${listResult.count} lists`);
        }

        // Transfer all tags
        const tagCount = await prisma.tag.count({ where: { ownerId: oldUser.id } });
        if (tagCount > 0) {
            const tagResult = await prisma.tag.updateMany({
                where: { ownerId: oldUser.id },
                data: { ownerId: newUser.id }
            });
            console.log(`✓ Transferred ${tagResult.count} tags`);
        }

        // Transfer all item ranks
        const rankCount = await prisma.itemRank.count({ where: { userId: oldUser.id } });
        if (rankCount > 0) {
            const rankResult = await prisma.itemRank.updateMany({
                where: { userId: oldUser.id },
                data: { userId: newUser.id }
            });
            console.log(`✓ Transferred ${rankResult.count} item ranks`);
        }

        // Delete old user account
        await prisma.user.delete({ where: { id: oldUser.id } });
        console.log(`✓ Deleted old account: ${oldUser.email}`);

        console.log('\n✅ Account merge complete!');
        console.log(`All data now belongs to: ${newUser.email}`);

    } catch (error) {
        console.error('Error during merge:', error);
    } finally {
        await prisma.$disconnect();
    }
}

mergeAccounts();
