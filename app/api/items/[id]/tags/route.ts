import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { tagName } = await req.json();
        if (!tagName) return new NextResponse("Tag Name required", { status: 400 });

        const normalizedTagName = tagName.trim().toLowerCase();

        const tag = await prisma.tag.upsert({
            where: { name: normalizedTagName },
            update: {},
            create: { name: normalizedTagName }
        });

        // Link tag to item (idempotent)
        await prisma.itemTag.upsert({
            where: {
                itemId_tagId: {
                    itemId: id,
                    tagId: tag.id
                }
            },
            create: {
                itemId: id,
                tagId: tag.id
            },
            update: {}
        });

        return NextResponse.json(tag);
    } catch (e) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) return new NextResponse("Missing tagId", { status: 400 });

    try {
        await prisma.itemTag.delete({
            where: {
                itemId_tagId: {
                    itemId: id,
                    tagId: tagId
                }
            }
        });
        return new NextResponse(null, { status: 204 });
    } catch (e) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
