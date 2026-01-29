import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        const { tagName, tagNames } = await req.json();

        // Support both single tagName (legacy) and tagNames array
        let tagsToProcess: string[] = [];
        if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
            // Deduplicate and normalize tagNames directly
            tagsToProcess = Array.from(new Set(tagNames.map((t: string) => t.trim().toLowerCase()).filter(Boolean)));
        } else if (tagName) {
            // Deduplicate and normalize single tagName
            const normalizedTagName = tagName.trim().toLowerCase();
            if (normalizedTagName) {
                tagsToProcess = [normalizedTagName];
            }
        }

        if (tagsToProcess.length === 0) {
            return new NextResponse("Tag names required", { status: 400 });
        }

        const normalizedTags = Array.from(new Set(tagsToProcess.map(t => t.trim().toLowerCase()).filter(Boolean)));

        console.log("[Smart List API] Creating list with tags:", normalizedTags);

        // 1. Find or Create Tags
        const tagObjects: any[] = [];
        for (const name of normalizedTags) {
            try {
                const tag = await prisma.tag.upsert({
                    where: { name },
                    update: {},
                    create: { name }
                });
                tagObjects.push(tag);
            } catch (tagError) {
                console.error(`[Smart List API] Failed to upsert tag "${name}":`, tagError);
                throw tagError;
            }
        }

        // 2. Check for existing Smart List for this user and EXACT set of tags
        const potentialLists = await prisma.list.findMany({
            where: {
                // @ts-ignore
                ownerId: userId,
                filterTags: {
                    some: {
                        tagId: { in: tagObjects.map(t => t.id) }
                    }
                }
            },
            include: {
                filterTags: true
            }
        });

        const existingList = potentialLists.find(list => {
            if (list.filterTags.length !== tagObjects.length) return false;
            const listTagIds = list.filterTags.map(ft => ft.tagId).sort();
            const targetTagIds = tagObjects.map(t => t.id).sort();
            return listTagIds.every((id, index) => id === targetTagIds[index]);
        });

        if (existingList) {
            console.log("[Smart List API] Found existing list:", existingList.id);
            return NextResponse.json({ listId: existingList.id });
        }

        // 3. Create new Smart List
        const title = normalizedTags.map(t => `#${t}`).join(" + ");
        console.log("[Smart List API] Saving new list:", title);

        const newList = await prisma.list.create({
            data: {
                title: title,
                // @ts-ignore
                ownerId: userId,
                filterTags: {
                    create: tagObjects.map(tag => ({
                        tagId: tag.id
                    }))
                }
            }
        });

        console.log("[Smart List API] Successfully created list:", newList.id);
        return NextResponse.json({ listId: newList.id });

    } catch (error: any) {
        console.error("Smart list creation error:", error);
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
