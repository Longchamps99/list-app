import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    const { listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    // 1. Fetch List Definition (Context & Shares)
    const list = await prisma.list.findUnique({
        where: { id: listId },
        include: {
            filterTags: { include: { tag: true } },
            shares: {
                // @ts-ignore
                where: { userId: userId }
            }
        }
    });

    if (!list) return new NextResponse("Not Found", { status: 404 });

    // Access Control
    const isShared = list.shares.length > 0;
    // @ts-ignore
    if (list.ownerId !== userId && !isShared) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // 2. Build Smart Filter
    // Logic: Items must have ALL listed tags? Or ANY?
    // User Requirement: "combining tags ... will return all items that contain those three tags" -> AND logic.
    // If no tags, return all items? Or allow empty lists? Let's assume return all items for now (Inbox).

    // We need to fetch Items. Whose items?
    // If I own the list, I see my items matching the filter.
    // If list is shared with me: Do I see OWNER's items? Yes.
    // Do I see MY items? Maybe? 
    // Usually shared list means seeing the same items. So we look for items owned by List Owner.

    const targetOwnerId = list.ownerId;
    const tags = list.filterTags.map(ft => ft.tag.name);

    let whereClause: any = {
        ownerId: targetOwnerId
    };

    if (tags.length > 0) {
        whereClause.AND = tags.map(tagName => ({
            tags: {
                some: {
                    tag: { name: tagName }
                }
            }
        }));
    }

    // 3. Fetch Items
    let items = await prisma.item.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
            tags: { include: { tag: true } },
            shares: {
                include: {
                    sharedBy: {
                        select: {
                            name: true,
                            image: true,
                            email: true
                        }
                    }
                }
            },
            // @ts-ignore
            ranks: {
                where: {
                    // @ts-ignore
                    // @ts-ignore
                    userId: userId,
                    contextId: listId
                }
            }
        }
    });

    // Sort by Rank
    items.sort((a, b) => {
        // @ts-ignore
        const rankA = a.ranks?.[0]?.rank || "0|zzzzzz:";
        // @ts-ignore
        const rankB = b.ranks?.[0]?.rank || "0|zzzzzz:";
        return rankA.localeCompare(rankB);
    });

    return NextResponse.json({ ...list, items });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    const { listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        await prisma.list.delete({
            where: {
                id: listId,
                // @ts-ignore
                ownerId: userId
            }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    const { listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        const { title } = await req.json();
        const list = await prisma.list.update({
            where: {
                id: listId,
                // @ts-ignore
                ownerId: userId
            },
            data: { title }
        });
        return NextResponse.json(list);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
