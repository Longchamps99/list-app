import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// POST: Add an item to a list by copying the list's filter tags to the item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        const { itemId } = await req.json();

        if (!itemId) {
            return new NextResponse("itemId is required", { status: 400 });
        }

        // Fetch list and check access
        const list = await prisma.list.findUnique({
            where: { id: listId },
            include: {
                filterTags: { include: { tag: true } },
                shares: {
                    where: { userId }
                }
            }
        });

        if (!list) {
            return new NextResponse("List not found", { status: 404 });
        }

        // Check access: owner or collaborator with WRITE permission
        const isOwner = list.ownerId === userId;
        // @ts-ignore - permission field exists after migration
        const hasWriteAccess = list.shares.some(s => s.permission === 'WRITE');

        if (!isOwner && !hasWriteAccess) {
            return new NextResponse("You don't have permission to add items to this list", { status: 403 });
        }

        // Verify item exists and user owns it
        const item = await prisma.item.findUnique({
            where: { id: itemId },
            include: { tags: true }
        });

        if (!item) {
            return new NextResponse("Item not found", { status: 404 });
        }

        if (item.ownerId !== userId) {
            return new NextResponse("You can only add your own items to lists", { status: 403 });
        }

        // Add the list's filter tags to the item (if not already present)
        const existingTagIds = new Set(item.tags.map(t => t.tagId));
        const tagsToAdd = list.filterTags
            .filter(ft => !existingTagIds.has(ft.tagId))
            .map(ft => ft.tagId);

        if (tagsToAdd.length > 0) {
            await prisma.itemTag.createMany({
                data: tagsToAdd.map(tagId => ({
                    itemId,
                    tagId
                })),
                skipDuplicates: true
            });
        }

        return NextResponse.json({
            success: true,
            tagsAdded: tagsToAdd.length,
            message: tagsToAdd.length > 0
                ? `Added ${tagsToAdd.length} tag(s) to match list filters`
                : "Item already matches list filters"
        });
    } catch (e) {
        console.error("[Add to List API] Error:", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// GET: Get items in a list (already exists in /api/lists/[id]/route.ts, but this provides a dedicated endpoint)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        const list = await prisma.list.findUnique({
            where: { id: listId },
            include: {
                filterTags: { include: { tag: true } },
                shares: {
                    where: { userId }
                }
            }
        });

        if (!list) {
            return new NextResponse("List not found", { status: 404 });
        }

        // Access Control
        const isOwner = list.ownerId === userId;
        const isShared = list.shares.length > 0;

        if (!isOwner && !isShared) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Items shown depend on list owner
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

        const items = await prisma.item.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            include: {
                tags: { include: { tag: true } }
            }
        });

        return NextResponse.json(items);
    } catch (e) {
        console.error("[List Items API] Error:", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
