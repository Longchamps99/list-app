import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

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

        // Calculate item count for each list
        const listsWithCounts = await Promise.all(
            lists.map(async (list) => {
                const tagNames = list.filterTags.map(ft => ft.tag.name.toLowerCase());

                if (tagNames.length === 0) {
                    return { ...list, itemCount: 0 };
                }

                const itemCount = await prisma.item.count({
                    where: {
                        ownerId: list.ownerId,
                        AND: tagNames.map(tagName => ({
                            tags: {
                                some: {
                                    tag: {
                                        name: { equals: tagName, mode: 'insensitive' }
                                    }
                                }
                            }
                        }))
                    }
                });

                return { ...list, itemCount };
            })
        );

        return NextResponse.json(listsWithCounts);
    } catch (error) {
        console.error('[Lists API] Error:', error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        // @ts-ignore
        const userId = user.id;

        const { title, tags } = await req.json(); // tags: string[]

        const list = await prisma.list.create({
            data: {
                title,
                // @ts-ignore
                ownerId: userId,
            },
        });

        if (tags && Array.isArray(tags) && tags.length > 0) {
            const normalizedTags = Array.from(new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean)));
            for (const normalizedTagName of normalizedTags) {
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

        // Capture list created event (gracefully handle analytics failures)
        try {
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
        } catch (analyticsError) {
            console.error("[Lists API POST] PostHog capture failed:", analyticsError);
        }

        return NextResponse.json(list);
    } catch (error: any) {
        console.error('[Lists API POST] Error:', error);
        return new NextResponse(JSON.stringify({
            error: "Internal Error",
            message: error.message,
            code: error.code
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
