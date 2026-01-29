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

    const tagNames = tagsParam.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);

    if (tagNames.length === 0) {
        return NextResponse.json({ items: [], matchingTags: [] });
    }

    try {
        // 1. Find the Tag objects for the requested names
        const matchingTags = await prisma.tag.findMany({
            where: {
                name: { in: tagNames, mode: 'insensitive' }
            }
        });

        // 2. Find items that match ALL tags
        // This is complex in Prisma. A common way is to find items where the count of matching tags equals the count of requested tags.
        // Or using AND query for each tag.

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
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return NextResponse.json({ items, matchingTags });
    } catch (error) {
        console.error("Smart list preview error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
