import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    const { searchParams } = new URL(req.url);
    const tagsParam = searchParams.get("tags");

    if (!tagsParam) {
        return NextResponse.json({ items: [], matchingTags: [] });
    }

    const tagNames = Array.from(new Set(tagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)));

    if (tagNames.length === 0) {
        return NextResponse.json({ items: [], matchingTags: [] });
    }

    try {
        // 1. Find the Tag objects for the requested names
        const matchingTags = await prisma.tag.findMany({
            where: {
                OR: tagNames.map(name => ({
                    name: { equals: name, mode: 'insensitive' }
                }))
            }
        });

        // 2. Find items that match ALL tags
        // This is complex in Prisma. A common way is to find items where the count of matching tags equals the count of requested tags.
        // Or using AND query for each tag.

        // Create a unique contextId for this smart list combination
        const contextId = `smart:${tagNames.sort().join('+')}`;

        const items = await prisma.item.findMany({
            where: {
                // @ts-ignore
                ownerId: userId,
                AND: tagNames.map(tagName => ({
                    tags: {
                        some: {
                            tag: {
                                name: { equals: tagName, mode: 'insensitive' }
                            }
                        }
                    }
                }))
            },
            include: {
                tags: {
                    include: {
                        tag: true
                    }
                },
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
                        userId: userId,
                        contextId: contextId
                    }
                }
            }
        });

        // Sort by rank if available, otherwise by createdAt
        items.sort((a, b) => {
            // @ts-ignore
            const rankA = a.ranks?.[0]?.rank || '0|h00000:';
            // @ts-ignore
            const rankB = b.ranks?.[0]?.rank || '0|h00000:';
            return rankA.localeCompare(rankB);
        });

        return NextResponse.json({ items, matchingTags, contextId });
    } catch (error) {
        console.error("Smart list preview error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
