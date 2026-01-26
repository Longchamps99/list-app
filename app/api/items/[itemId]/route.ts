import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
    const { itemId } = await params;
    const user = await getCurrentUser();

    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
            tags: { include: { tag: true } },
            // @ts-ignore
            shares: { where: { userId: userId } }
        }
    });

    if (!item) return new NextResponse("Not Found", { status: 404 });

    // @ts-ignore
    const isOwner = item.ownerId === userId;
    // @ts-ignore
    const isShared = item.shares.length > 0;

    if (!isOwner && !isShared) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.json(item);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
    const { itemId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    // Verify ownership
    const item = await prisma.item.findUnique({
        where: { id: itemId }
    });

    if (!item) return new NextResponse("Not Found", { status: 404 });

    // @ts-ignore
    // @ts-ignore
    if (item.ownerId !== userId) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    await prisma.item.delete({ where: { id: itemId } });

    // Capture item deleted event
    const posthog = getPostHogClient();
    posthog.capture({
        distinctId: userId,
        event: 'item_deleted',
        properties: {
            item_id: itemId,
            title: item.title,
        }
    });

    return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
    const { itemId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    const { isChecked, content, title, imageUrl, link, location } = await req.json();

    // Verify ownership or shared access
    const existingItem = await prisma.item.findUnique({
        where: { id: itemId },
        // @ts-ignore
        // @ts-ignore
        include: { shares: { where: { userId: userId } } }
    });

    if (!existingItem) return new NextResponse("Not Found", { status: 404 });

    // @ts-ignore
    // @ts-ignore
    const isOwner = existingItem.ownerId === userId;
    // @ts-ignore
    const isShared = existingItem.shares.length > 0;

    if (!isOwner && !isShared) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const item = await prisma.item.update({
            where: { id: itemId },
            data: {
                ...(isChecked !== undefined && { isChecked }),
                ...(content !== undefined && { content }),
                ...(title !== undefined && { title }),
                ...(imageUrl !== undefined && { imageUrl }),
                ...(link !== undefined && { link }),
                ...(location !== undefined && { location })
            }
        });
        return NextResponse.json(item);
    } catch (e) {
        console.error(e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
