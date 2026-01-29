import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LexoRank } from "lexorank";

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
        let currentRank = LexoRank.middle();

        await prisma.$transaction(async (tx) => {
            for (const itemData of items) {
                const { title, tags, description, imageUrl } = itemData;

                // Create the item first
                const newItem = await tx.item.create({
                    data: {
                        title: title,
                        content: description || "",
                        imageUrl: imageUrl || null,
                        ownerId: userId,
                    }
                });

                // Create the rank entry for dashboard
                await tx.itemRank.create({
                    data: {
                        itemId: newItem.id,
                        contextId: "dashboard",
                        userId: userId,
                        rank: currentRank.toString(),
                    }
                });

                // Handle tags
                if (tags && Array.isArray(tags)) {
                    for (const tagName of tags) {
                        const cleanTag = tagName.trim();
                        if (!cleanTag) continue;

                        // Find or create tag
                        let tag = await tx.tag.findFirst({ where: { name: cleanTag } });
                        if (!tag) {
                            tag = await tx.tag.create({ data: { name: cleanTag } });
                        }

                        // Create ItemTag relation
                        await tx.itemTag.create({
                            data: {
                                itemId: newItem.id,
                                tagId: tag.id
                            }
                        });
                    }
                }

                results.push(newItem);
                currentRank = currentRank.genNext();
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
