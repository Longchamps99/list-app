import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LexoRank } from "lexorank";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // @ts-ignore - user.id is added in session callback
        const userId = user.id;

        const { items, title } = await req.json();

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "No items provided" }, { status: 400 });
        }

        // Create the list
        const list = await prisma.list.create({
            data: {
                title: title || "My Top 5 Movies",
                ownerId: userId,
            },
        });

        // Generate ranks for items
        let currentRank = LexoRank.middle();

        for (const itemName of items) {
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

            currentRank = currentRank.genNext();
        }

        // Enrich items in the background (don't wait for this)
        enrichItemsInBackground(list.id).catch(err =>
            console.error("Background enrichment error:", err)
        );

        return NextResponse.json({
            message: "List created successfully",
            listId: list.id
        });

    } catch (error) {
        console.error("Create onboarding list error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

async function enrichItemsInBackground(listId: string) {
    // Get all items for this list via ItemRank
    const itemRanks = await prisma.itemRank.findMany({
        where: { contextId: listId },
        include: { item: true },
    });

    // Enrich each item
    for (const itemRank of itemRanks) {
        const item = itemRank.item;
        try {
            const enrichResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/enrich`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: item.title || item.content }),
            });

            if (enrichResponse.ok) {
                const enrichData = await enrichResponse.json();

                await prisma.item.update({
                    where: { id: item.id },
                    data: {
                        title: enrichData.title || item.title,
                        imageUrl: enrichData.imageUrl,
                        link: enrichData.link,
                    },
                });
            }
        } catch (err) {
            console.error(`Failed to enrich item ${item.id}:`, err);
            // Continue with other items even if one fails
        }
    }
}
