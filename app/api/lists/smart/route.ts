import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        const { tagName, tagNames } = await req.json();

        // Support both single tagName (legacy) and tagNames array
        let tagsToProcess: string[] = [];
        if (tagNames && Array.isArray(tagNames)) {
            tagsToProcess = tagNames;
        } else if (tagName) {
            tagsToProcess = [tagName];
        }

        if (tagsToProcess.length === 0) {
            return new NextResponse("Tag names required", { status: 400 });
        }

        const normalizedTags = tagsToProcess.map(t => t.trim().toLowerCase()).filter(Boolean);

        // 1. Find or Create Tags
        const tagObjects: any[] = [];
        for (const name of normalizedTags) {
            const tag = await prisma.tag.upsert({
                where: { name },
                update: {},
                create: { name }
            });
            tagObjects.push(tag);
        }

        // 2. Check for existing Smart List for this user and EXACT set of tags
        // This query is tricky in Prisma. We want a list where:
        // - owner is user
        // - count of filterTags is exactly the count of our tags
        // - AND all of our tagIds are present

        // Simplified approach: Create a new list if complex query is too hard, OR just try to find one with the *first* tag and then filter in JS?
        // Let's try to find potential matches first.

        // Find lists owned by user that have at least one of our tags
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
            return NextResponse.json({ listId: existingList.id });
        }

        // 3. Create new Smart List
        const title = normalizedTags.map(t => `#${t}`).join(" + ");

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

        return NextResponse.json({ listId: newList.id });

    } catch (error) {
        console.error("Smart list creation error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
