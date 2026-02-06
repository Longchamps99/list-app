const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getList() {
    try {
        const list = await prisma.list.findFirst();
        if (list) {
            console.log(`List ID: ${list.id}`);
        } else {
            console.log("No lists found.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getList();
