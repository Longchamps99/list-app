import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { generateTags } from "@/lib/ai";

export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    const { listId } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    // 1. Get the list to understand its Filter Tags (Context)
    const list = await prisma.list.findUnique({
        where: { id: listId },
        include: {
            filterTags: { include: { tag: true } },
            // @ts-ignore
            shares: { where: { userId: userId } }
        }
    });

    if (!list) return new NextResponse("List not found", { status: 404 });

    // Access Control
    const isShared = list.shares.length > 0;
    // @ts-ignore
    if (list.ownerId !== userId && !isShared) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { content, title, imageUrl, link, location, customTags } = await req.json();

        // 2. Generate AI Tags (from Title + Content)
        const textToAnalyze = `${title || ""} ${content}`.trim();
        const aiTags = await generateTags(textToAnalyze);

        // 3. Collect Context Tags (from Smart List definition)
        const contextTags = list.filterTags.map(ft => ft.tag.name);

        // 4. Collect Custom Tags (from enrichment API / user selection)
        const userTags = Array.isArray(customTags) ? customTags : [];

        // 5. Merge Tags (prioritize custom tags from enrichment, then context, then AI)
        const allTagNames = Array.from(new Set([...userTags, ...contextTags, ...aiTags]));

        // 6. Create Item linked to Owner
        const item = await prisma.item.create({
            data: {
                content, // Description
                title,
                imageUrl,
                link,
                location,
                ownerId: list.ownerId,
            },
        });

        // 7. Associate Tags
        for (const tagName of allTagNames) {
            // Find/Create Tag
            const tag = await prisma.tag.upsert({
                where: { name: tagName },
                update: {},
                create: { name: tagName }
            });

            // Link Item-Tag (Idempotent)
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
