import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        // @ts-ignore
        const userId = user.id;

        // Fetch total items count
        const totalItems = await prisma.item.count({
            where: { ownerId: userId }
        });

        // Fetch last updated timestamp from items
        const lastUpdatedItem = await prisma.item.findFirst({
            where: { ownerId: userId },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        // Fetch last updated timestamp from lists
        const lastUpdatedList = await prisma.list.findFirst({
            where: { ownerId: userId },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });

        // Determine the most recent update
        let lastUpdated = null;
        if (lastUpdatedItem && lastUpdatedList) {
            lastUpdated = lastUpdatedItem.updatedAt > lastUpdatedList.updatedAt
                ? lastUpdatedItem.updatedAt
                : lastUpdatedList.updatedAt;
        } else if (lastUpdatedItem) {
            lastUpdated = lastUpdatedItem.updatedAt;
        } else if (lastUpdatedList) {
            lastUpdated = lastUpdatedList.updatedAt;
        }

        return NextResponse.json({
            totalItems,
            lastUpdated
        });
    } catch (error) {
        console.error('[User Stats API] Error:', error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
