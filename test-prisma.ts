import { prisma } from "./lib/prisma"

async function main() {
    console.log("Checking prisma...");
    try {
        const count = await prisma.user.count();
        console.log("User count:", count);
    } catch (e) {
        console.error("Prisma Error:", e);
    }
}

main()
    .catch(e => console.error("Main Error:", e))
    .finally(async () => {
        await prisma.$disconnect()
    })
