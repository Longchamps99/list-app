import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    // --- Virtual Lists Handling ---
    if (id === 'virtual-want' || id === 'virtual-have') {
        const isWant = id === 'virtual-want';
        const title = isWant ? 'Want to Experience' : 'Have Experienced';

        // Fetch all items for filtering
        const allItems = await prisma.item.findMany({
            where: { ownerId: userId },
            include: {
                tags: { include: { tag: true } },
                shares: {
                    include: {
                        sharedBy: {
                            select: { name: true, image: true, email: true }
                        }
                    }
                },
                // @ts-ignore
                ranks: {
                    where: {
                        // @ts-ignore
                        userId: userId,
                        contextId: id // Use virtual ID for ranking context
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Filter items
        const isPerson = (item: any) => {
            const firstTagName = item.tags?.[0]?.tag?.name;
            if (!firstTagName) return false;
            return firstTagName.toLowerCase().replace('#', '') === 'person';
        };

        const filteredItems = allItems.filter(item => {
            if (isPerson(item)) return false;

            if (isWant) {
                return item.status === 'WANT_TO_EXPERIENCE';
            } else {
                return item.status === 'EXPERIENCED' || item.status === null;
            }
        });

        // Sort by Rank
        filteredItems.sort((a, b) => {
            // @ts-ignore
            const rankA = a.ranks?.[0]?.rank || "0|h00000:";
            // @ts-ignore
            const rankB = b.ranks?.[0]?.rank || "0|h00000:";
            return rankA.localeCompare(rankB);
        });

        return NextResponse.json({
            id,
            title,
            filterTags: [],
            createdAt: new Date(0).toISOString(),
            ownerId: userId,
            owner: { email: user.email, id: userId },
            shares: [],
            items: filteredItems
        });
    }

    // 1. Fetch List Definition (Context & Shares)
    const list = await prisma.list.findUnique({
        where: { id: id },
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
                    contextId: id
                }
            }
        }
    });

    // Sort by Rank
    items.sort((a, b) => {
        // @ts-ignore
        const rankA = a.ranks?.[0]?.rank || "0|h00000:";
        // @ts-ignore
        const rankB = b.ranks?.[0]?.rank || "0|h00000:";
        return rankA.localeCompare(rankB);
    });

    return NextResponse.json({ ...list, items });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        await prisma.list.delete({
            where: {
                id: id,
                // @ts-ignore
                ownerId: userId
            }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        // Check access: owner or collaborator with WRITE permission
        const list = await prisma.list.findUnique({
            where: { id },
            include: {
                shares: {
                    where: { userId }
                }
            }
        });

        if (!list) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const isOwner = list.ownerId === userId;
        const hasWriteAccess = list.shares.some((s: any) => s.permission === 'WRITE');

        if (!isOwner && !hasWriteAccess) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const { title } = await req.json();
        const updatedList = await prisma.list.update({
            where: { id },
            data: { title }
        });
        return NextResponse.json(updatedList);
    } catch (error) {
        console.error("[List PATCH] Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
