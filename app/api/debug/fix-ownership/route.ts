import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-ignore
    // @ts-ignore
    const userId = session.user.id;

    try {
        const result = await prisma.item.updateMany({
            data: {
                ownerId: userId
            }
        });

        // Also fix lists
        const listResult = await prisma.list.updateMany({
            data: {
                ownerId: userId
            }
        });

        return NextResponse.json({
            message: "Ownership fixed",
            itemsUpdated: result.count,
            listsUpdated: listResult.count,
            newOwnerId: userId
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
