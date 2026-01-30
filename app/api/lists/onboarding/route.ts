import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LexoRank } from "lexorank";
import { enrichItems } from "@/lib/enrichment";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // @ts-ignore - user.id is added in session callback
        const userId = user.id;

        const { items, title } = await req.json() as { items: string[], title: string };

        // Deduplicate items
        const uniqueItems = Array.from(new Set(items.filter((i: string) => i && i.trim() !== "")));

        if (uniqueItems.length === 0) {
            return NextResponse.json({ message: "No items provided" }, { status: 400 });
        }

        console.log(`[Onboarding] Creating list "${title}" with ${uniqueItems.length} items for user ${userId}`);

        // Create the list
        const list = await prisma.list.create({
            data: {
                title: title || "My Top 5 Movies",
                ownerId: userId,
            },
        });

        // Generate ranks for items
        let currentRank = LexoRank.middle();
        const createdItemIds: string[] = [];

        for (const itemName of uniqueItems) {
            // @ts-ignore - itemName is string because we filtered above
            if (!itemName || itemName.trim() === "") continue;

            // Create the item
            const item = await prisma.item.create({
                data: {
                    content: itemName.trim(),
                    title: itemName.trim(),
                    ownerId: userId,
                },
            });

            // Create the rank entry to associate item with list
            await prisma.itemRank.create({
                data: {
                    itemId: item.id,
                    contextId: list.id,
                    userId: userId,
                    rank: currentRank.toString(),
                },
            });

            createdItemIds.push(item.id);
            currentRank = currentRank.genNext();
        }

        // Enrich items synchronously to ensure reliability
        try {
            await enrichListItems(list.id);
        } catch (enrichErr) {
            console.error("[Onboarding] Enrichment failed but list was created:", enrichErr);
        }

        return NextResponse.json({
            message: "List created successfully",
            listId: list.id
        });

    } catch (error) {
        console.error("Create onboarding list error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

async function enrichListItems(listId: string) {
    console.log(`[Onboarding] Starting enrichment for list: ${listId}`);

    // Get all items for this list
    const itemRanks = await prisma.itemRank.findMany({
        where: { contextId: listId },
        include: { item: true },
        orderBy: { rank: 'asc' }
    });

    if (itemRanks.length === 0) return;

    const rawTitles = itemRanks.map(ir => ir.item.title || ir.item.content);
    console.log(`[Onboarding] Calling AI enrichment for items: ${rawTitles.join(", ")}`);

    try {
        const enriched = await enrichItems(rawTitles);
        console.log(`[Onboarding] Received ${enriched.length} results from AI`);

        for (let i = 0; i < itemRanks.length; i++) {
            const item = itemRanks[i].item;
            const data = enriched[i];

            if (!data) continue;

            console.log(`[Onboarding] Updating item ${item.id} with data for "${data.title}"`);

            await prisma.item.update({
                where: { id: item.id },
                data: {
                    title: data.title || item.title,
                    content: data.description || item.content,
                    imageUrl: data.imageUrl,
                },
            });

            // Handle Tags
            if (data.tags && Array.isArray(data.tags)) {
                for (const tagName of data.tags) {
                    try {
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
                            update: {},
                            create: {
                                itemId: item.id,
                                tagId: tag.id
                            }
                        });
                    } catch (e) {
                        // Ignore individual tag errors
                    }
                }
            }
        }
        console.log(`[Onboarding] Enrichment complete for list ${listId}`);
    } catch (error) {
        console.error(`[Onboarding] Enrichment process error:`, error);
        throw error;
    }
}
