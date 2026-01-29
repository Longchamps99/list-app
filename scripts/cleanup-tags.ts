import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTags() {
    console.log('Starting tag cleanup...');

    // 1. Find all tags with uppercase letters
    const allTags = await prisma.tag.findMany();
    const uppercaseTags = allTags.filter(tag => tag.name !== tag.name.toLowerCase());

    console.log(`Found ${uppercaseTags.length} tags with uppercase letters`);

    for (const uppercaseTag of uppercaseTags) {
        const lowercaseName = uppercaseTag.name.toLowerCase();
        console.log(`Processing: "${uppercaseTag.name}" -> "${lowercaseName}"`);

        // 2. Find or create the lowercase version
        let lowercaseTag = await prisma.tag.findFirst({
            where: { name: lowercaseName }
        });

        if (!lowercaseTag) {
            console.log(`  Creating lowercase tag: ${lowercaseName}`);
            lowercaseTag = await prisma.tag.create({
                data: { name: lowercaseName }
            });
        } else {
            console.log(`  Found existing lowercase tag: ${lowercaseTag.id}`);
        }

        // 3. Move ItemTag associations
        const itemTags = await prisma.itemTag.findMany({
            where: { tagId: uppercaseTag.id }
        });
        console.log(`  Found ${itemTags.length} item associations`);

        for (const itemTag of itemTags) {
            // Check if lowercase association already exists
            const existingAssociation = await prisma.itemTag.findUnique({
                where: {
                    itemId_tagId: {
                        itemId: itemTag.itemId,
                        tagId: lowercaseTag.id
                    }
                }
            });

            if (!existingAssociation) {
                // Create new association with lowercase tag
                await prisma.itemTag.create({
                    data: {
                        itemId: itemTag.itemId,
                        tagId: lowercaseTag.id
                    }
                });
                console.log(`    Moved item ${itemTag.itemId} to lowercase tag`);
            } else {
                console.log(`    Item ${itemTag.itemId} already has lowercase tag`);
            }

            // Delete the old uppercase association
            await prisma.itemTag.delete({
                where: {
                    itemId_tagId: {
                        itemId: itemTag.itemId,
                        tagId: uppercaseTag.id
                    }
                }
            });
        }

        // 4. Move ListFilterTag associations
        const listFilterTags = await prisma.listFilterTag.findMany({
            where: { tagId: uppercaseTag.id }
        });
        console.log(`  Found ${listFilterTags.length} list filter associations`);

        for (const listFilterTag of listFilterTags) {
            // Check if lowercase association already exists
            const existingAssociation = await prisma.listFilterTag.findUnique({
                where: {
                    listId_tagId: {
                        listId: listFilterTag.listId,
                        tagId: lowercaseTag.id
                    }
                }
            });

            if (!existingAssociation) {
                await prisma.listFilterTag.create({
                    data: {
                        listId: listFilterTag.listId,
                        tagId: lowercaseTag.id
                    }
                });
                console.log(`    Moved list ${listFilterTag.listId} to lowercase tag`);
            } else {
                console.log(`    List ${listFilterTag.listId} already has lowercase tag`);
            }

            // Delete the old uppercase association
            await prisma.listFilterTag.delete({
                where: {
                    listId_tagId: {
                        listId: listFilterTag.listId,
                        tagId: uppercaseTag.id
                    }
                }
            });
        }

        // 5. Delete the uppercase tag
        await prisma.tag.delete({
            where: { id: uppercaseTag.id }
        });
        console.log(`  Deleted uppercase tag: ${uppercaseTag.name}`);
    }

    console.log('\nTag cleanup complete!');

    // Show remaining tags
    const remainingTags = await prisma.tag.findMany();
    console.log(`\nRemaining tags (${remainingTags.length}):`);
    remainingTags.forEach(tag => console.log(`  - ${tag.name}`));
}

cleanupTags()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
