import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // @ts-ignore
    const userId = user.id;

    const lists = await prisma.list.findMany({
        where: {
            OR: [
                // @ts-ignore
                { ownerId: userId },
                // @ts-ignore
                { shares: { some: { userId: userId } } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
            filterTags: { include: { tag: true } },
            shares: { include: { user: { select: { email: true } } } },
            owner: { select: { email: true, id: true } }
        }
    });

    // Compute Item counts? 
    // Since items are decoupled, we need to count items matching the filter for EACH list.
    // This is expensive (N queries). For MVP, maybe we skip count or fetch simplified count?
    // Or we do a single query grouping?
    // For now, let's just return the definition. Calculating count dynamically is hard.
    // Alternatively, we return a "loading" count or just don't show count yet.
    // Let's remove count for now to avoid complexity or potential errors.

    return NextResponse.json(lists);
}

export async function POST(req: Request) {
    const user = await getCurrentUser();

    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // @ts-ignore
    const userId = user.id;

    try {
        const { title, tags } = await req.json(); // tags: string[]

        const list = await prisma.list.create({
            data: {
                title,
                // @ts-ignore
                ownerId: userId,
            },
        });

        if (tags && Array.isArray(tags) && tags.length > 0) {
            for (const tagName of tags) {
                const normalizedTagName = tagName.trim();
                const tag = await prisma.tag.upsert({
                    where: { name: normalizedTagName },
                    update: {},
                    create: { name: normalizedTagName }
                });

                await prisma.listFilterTag.create({
                    data: {
                        listId: list.id,
                        tagId: tag.id
                    }
                });
            }
        }

        // Capture list created event
        const posthog = getPostHogClient();
        posthog.capture({
            distinctId: userId,
            event: 'list_created',
            properties: {
                list_id: list.id,
                title: title,
                tag_count: tags?.length || 0,
            }
        });

        return NextResponse.json(list);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
