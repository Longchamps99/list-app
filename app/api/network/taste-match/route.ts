import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/network/taste-match
 * 
 * Calculates "taste match" scores between the current user and other users
 * based on overlapping items across their lists.
 * 
 * Algorithm:
 * 1. Get all itemIds from current user's owned lists (including clones)
 * 2. For each other user in the network:
 *    - Get their itemIds from their owned lists
 *    - Calculate overlap: (common items / union of items) * 100
 * 3. Return sorted list of users with match percentages
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        // @ts-ignore
        const userId = user.id;

        // Step 1: Get all items from current user's owned lists
        const myLists = await prisma.list.findMany({
            where: { ownerId: userId },
            include: {
                filterTags: { include: { tag: true } }
            }
        });

        // Get all tag names from my lists
        const myTagNames = new Set<string>();
        myLists.forEach(list => {
            list.filterTags.forEach(ft => myTagNames.add(ft.tag.name.toLowerCase()));
        });

        // Get all items that have any of my list tags
        const myItems = await prisma.item.findMany({
            where: {
                ownerId: userId,
                tags: {
                    some: {
                        tag: {
                            name: { in: Array.from(myTagNames) }
                        }
                    }
                }
            },
            select: { id: true }
        });

        const myItemIds = new Set(myItems.map(i => i.id));

        if (myItemIds.size === 0) {
            return NextResponse.json({
                matches: [],
                myItemCount: 0,
                message: "Add items to your lists to see taste matches"
            });
        }

        // Step 2: Find all other users who have lists
        const otherUsers = await prisma.user.findMany({
            where: {
                id: { not: userId },
                lists: { some: {} } // Only users with lists
            },
            select: {
                id: true,
                email: true,
                name: true,
                image: true
            }
        });

        // Step 3: Calculate overlap for each user
        const matches = await Promise.all(
            otherUsers.map(async (otherUser) => {
                // Get other user's list tags
                const theirLists = await prisma.list.findMany({
                    where: { ownerId: otherUser.id },
                    include: {
                        filterTags: { include: { tag: true } },
                        // Check if this list was cloned from one of my lists
                        forkedFrom: true
                    }
                });

                // Get their tag names
                const theirTagNames = new Set<string>();
                theirLists.forEach(list => {
                    list.filterTags.forEach(ft => theirTagNames.add(ft.tag.name.toLowerCase()));
                });

                // Get their items
                const theirItems = await prisma.item.findMany({
                    where: {
                        ownerId: otherUser.id,
                        tags: {
                            some: {
                                tag: {
                                    name: { in: Array.from(theirTagNames) }
                                }
                            }
                        }
                    },
                    select: { id: true }
                });

                const theirItemIds = new Set(theirItems.map(i => i.id));

                // Calculate overlap
                // Find items with matching content/title (since itemIds won't match across users)
                // Better approach: Compare based on tags overlap
                const commonTags = Array.from(myTagNames).filter(t => theirTagNames.has(t));
                const allTags = new Set([...myTagNames, ...theirTagNames]);

                const tagOverlapScore = allTags.size > 0
                    ? (commonTags.length / allTags.size) * 100
                    : 0;

                // Check for cloned lists (100% match on those)
                const clonedFromMe = theirLists.filter(l =>
                    l.forkedFrom && myLists.some(ml => ml.id === l.forkedFromId)
                );

                // Boost score if they cloned from me
                let finalScore = tagOverlapScore;
                if (clonedFromMe.length > 0) {
                    // Add bonus for each cloned list
                    const cloneBonus = Math.min(30, clonedFromMe.length * 15);
                    finalScore = Math.min(100, tagOverlapScore + cloneBonus);
                }

                return {
                    userId: otherUser.id,
                    email: otherUser.email,
                    name: otherUser.name,
                    image: otherUser.image,
                    matchScore: Math.round(finalScore),
                    commonTagCount: commonTags.length,
                    theirItemCount: theirItemIds.size,
                    clonedListCount: clonedFromMe.length
                };
            })
        );

        // Sort by match score descending
        const sortedMatches = matches
            .filter(m => m.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore);

        return NextResponse.json({
            matches: sortedMatches,
            myItemCount: myItemIds.size,
            myTagCount: myTagNames.size
        });

    } catch (error) {
        console.error("[Network API] Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
