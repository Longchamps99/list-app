import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        const { contextId, updates } = await req.json(); // updates: { itemId, rank }[]

        if (!updates || !Array.isArray(updates)) {
            return new NextResponse("Invalid updates", { status: 400 });
        }

        // Transaction for batch update
        await prisma.$transaction(
            updates.map((u: { itemId: string; rank: string }) =>
                prisma.itemRank.upsert({
                    where: {
                        userId_contextId_itemId: {
                            // @ts-ignore
                            userId: userId,
                            contextId,
                            itemId: u.itemId
                        }
                    },
                    update: { rank: u.rank },
                    create: {
                        // @ts-ignore
                        userId: userId,
                        contextId,
                        itemId: u.itemId,
                        rank: u.rank
                    }
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
