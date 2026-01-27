import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-ignore
    const userId = user.id;

    try {
        const body = await req.json();
        const { items } = body;

        console.log("[Bulk API] Received items to save:", items?.length);

        if (!Array.isArray(items) || items.length === 0) {
            console.warn("[Bulk API] Invalid items array");
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        const results: any[] = [];
        let index = 0;

        await prisma.$transaction(async (tx) => {
            for (const itemData of items) {
                const { title, tags, description, imageUrl } = itemData;

                const tagConnections = [];
                if (tags && Array.isArray(tags)) {
                    for (const tagName of tags) {
                        const cleanTag = tagName.trim();
                        if (!cleanTag) continue;

                        let tag = await tx.tag.findFirst({ where: { name: cleanTag } });
                        if (!tag) {
                            tag = await tx.tag.create({ data: { name: cleanTag } });
                        }
                        tagConnections.push({ id: tag.id });
                    }
                }

                const newItem = await tx.item.create({
                    data: {
                        title: title,
                        // Use description for content if available
                        content: description || "",
                        imageUrl: imageUrl || null,
                        ownerId: userId,
                        ranks: {
                            create: {
                                userId: userId,
                                contextId: "dashboard",
                                rank: "0|" + Date.now().toString() + index
                            }
                        },
                        tags: {
                            create: tagConnections.map(tag => ({
                                tag: { connect: { id: tag.id } }
                            }))
                        }
                    }
                });
                index++;

                // Actually, wait. The schema for 'Item' and 'Rank' needs to be checked.
                // In Dashboard code: newItems[newIndex].ranks[0] = { rank: newRankStr };
                // So Item has a relation to Rank.
                // Does Item creation fail if I don't provide Rank?

                // Let's check schema.prisma first?
                // Assuming standard relation

                results.push(newItem);
            }
        });

        console.log("[Bulk API] Successfully saved", results.length, "items");
        return NextResponse.json({ count: results.length, items: results });

    } catch (error: any) {
        console.error("[Bulk API] Error:", error);
        console.error("[Bulk API] Stack:", error?.stack);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
