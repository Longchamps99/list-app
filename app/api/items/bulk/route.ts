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

        // Collect all unique tag names first
        const allTagNames = new Set<string>();
        items.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach((tag: string) => {
                    const cleanTag = tag.trim().toLowerCase();
                    if (cleanTag) allTagNames.add(cleanTag);
                });
            }
        });

        // Pre-fetch or create all tags OUTSIDE the main transaction to avoid timeout
        const tagMap = new Map<string, string>(); // name -> id
        for (const tagName of allTagNames) {
            let tag = await prisma.tag.findFirst({ where: { name: tagName } });
            if (!tag) {
                tag = await prisma.tag.create({ data: { name: tagName } });
            }
            tagMap.set(tagName, tag.id);
        }

        console.log("[Bulk API] Pre-created/fetched", tagMap.size, "tags");

        const results: any[] = [];
        let currentRank = LexoRank.middle();

        // Now do the bulk creation in a shorter transaction
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

                // Handle tags - now we just create the relations since tags already exist
                if (tags && Array.isArray(tags)) {
                    for (const tagName of tags) {
                        const cleanTag = tagName.trim().toLowerCase();
                        if (!cleanTag) continue;

                        const tagId = tagMap.get(cleanTag);
                        if (tagId) {
                            await tx.itemTag.create({
                                data: {
                                    itemId: newItem.id,
                                    tagId: tagId
                                }
                            });
                        }
                    }
                }

                results.push(newItem);
                currentRank = currentRank.genNext();
            }
        }, {
            timeout: 30000, // Increase timeout to 30 seconds
        });

        console.log("[Bulk API] Successfully saved", results.length, "items");
        return NextResponse.json({ count: results.length, items: results });

    } catch (error: any) {
        console.error("[Bulk API] Error:", error);
        console.error("[Bulk API] Error name:", error?.name);
        console.error("[Bulk API] Error code:", error?.code);
        console.error("[Bulk API] Error message:", error?.message);
        console.error("[Bulk API] Error meta:", error?.meta);
        console.error("[Bulk API] Stack:", error?.stack);

        // Return more detailed error for debugging
        return NextResponse.json({
            error: "Internal Server Error",
            details: error?.message,
            code: error?.code,
            meta: error?.meta
        }, { status: 500 });
    }
}
