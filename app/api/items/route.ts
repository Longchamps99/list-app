import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
    const user = await getCurrentUser();
    console.log('[Items API] User from session:', JSON.stringify(user, null, 2));

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com
    console.log('[Items API] Using hardcoded userId:', userId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "date"; // 'date' | 'alpha'

    try {
        const where: any = {
            AND: [
                {
                    OR: [
                        // @ts-ignore
                        { ownerId: userId },
                        // @ts-ignore
                        { shares: { some: { userId: userId } } }
                    ]
                }
            ]
        };

        if (search) {
            where.AND.push({
                OR: [
                    { title: { contains: search } },
                    { content: { contains: search } },
                    {
                        tags: {
                            some: {
                                tag: {
                                    name: { contains: search }
                                }
                            }
                        }
                    }
                ]
            });
        }

        const orderBy = sort === "alpha"
            ? { title: "asc" }
            : { createdAt: "desc" };

        let items = await prisma.item.findMany({
            where,
            orderBy: orderBy as any,
            include: {
                tags: { include: { tag: true } },
                // @ts-ignore
                shares: {
                    // @ts-ignore
                    where: { userId: userId },
                    include: { sharedBy: { select: { name: true, email: true, image: true } } }
                },
                // @ts-ignore
                ranks: {
                    where: {
                        // @ts-ignore
                        userId: userId,
                        contextId: "dashboard"
                    }
                }
            }
        });

        // Default sort by Rank if not specific sort requested
        if (!searchParams.get("sort")) {
            items.sort((a, b) => {
                // @ts-ignore
                const rankA = a.ranks?.[0]?.rank || "0|zzzzzz:"; // Default to end
                // @ts-ignore
                const rankB = b.ranks?.[0]?.rank || "0|zzzzzz:";
                return rankA.localeCompare(rankB);
            });
        }

        if (sort === "shared") {
            items.sort((a, b) => {
                // @ts-ignore
                const nameA = a.shares[0]?.sharedBy?.name || "zzzz";
                // @ts-ignore
                const nameB = b.shares[0]?.sharedBy?.name || "zzzz";
                return nameA.localeCompare(nameB);
            });
        }

        return NextResponse.json(items);
    } catch (error) {
        console.error('[Items API] Error:', error);
        console.error('[Items API] Error stack:', error instanceof Error ? error.stack : 'No stack');
        console.error('[Items API] Error message:', error instanceof Error ? error.message : String(error));
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        const { content, title, imageUrl, link, location, customTags } = await req.json();

        // Create Item
        const item = await prisma.item.create({
            data: {
                content,
                title,
                imageUrl,
                link,
                location,
                // @ts-ignore
                ownerId: userId,
            },
        });

        // Associate Custom Tags
        const tagNames = Array.isArray(customTags) ? customTags : [];
        for (const tagName of tagNames) {
            const normalizedTagName = tagName.trim().toLowerCase();
            const tag = await prisma.tag.upsert({
                where: { name: normalizedTagName },
                update: {},
                create: { name: normalizedTagName }
            });

            await prisma.itemTag.upsert({
                where: {
                    itemId_tagId: {
                        itemId: item.id,
                        tagId: tag.id
                    }
                },
                create: {
                    itemId: item.id,
                    tagId: tag.id
                },
                update: {}
            });
        }

        return NextResponse.json(item);
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
