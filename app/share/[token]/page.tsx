import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getPostHogClient } from "@/lib/posthog-server";

interface Props {
    params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: Props) {
    const { token } = await params;
    const session = await getServerSession(authOptions);

    // 1. Validate Token
    // @ts-ignore
    const shareToken = await prisma.shareToken.findUnique({
        where: { token },
        include: { creator: true }
    });

    if (!shareToken) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--swiss-off-white)] p-4">
                <div className="bg-white p-8 rounded-lg border border-[var(--swiss-border)] shadow-sm max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-[var(--swiss-red)] mb-4">Invalid Link</h1>
                    <p className="text-[var(--swiss-text-secondary)] mb-6">This share link is invalid or has expired.</p>
                    <Link href="/" className="text-[var(--swiss-text-secondary)] hover:text-[var(--swiss-black)] transition-colors">Go Home</Link>
                </div>
            </div>
        );
    }

    // 2. Handle Redemption
    if (session?.user?.email) {
        // User is logged in, redeem token
        try {
            // @ts-ignore
            const userId = session.user.id as string;
            const senderId = shareToken.creatorId;

            // PREVENT SELF-SHARING (Optional, but good UX. Or allow cloning own items?)
            // If sender == recipient, maybe just redirect to original?
            // User might want to "Duplicate" their own item. Let's allow it, but usually Sharing is to others.
            // If sender == userId, just redirect.
            if (senderId === userId) {
                if (shareToken.type === "ITEM") redirect(`/items/${shareToken.entityId}`);
                if (shareToken.type === "LIST") redirect(`/lists/${shareToken.entityId}`);
            }

            if (shareToken.type === "ITEM") {
                // Fetch Original
                const original = await prisma.item.findUnique({
                    where: { id: shareToken.entityId },
                    include: { tags: true }
                });

                if (!original) throw new Error("Original item not found");

                // Check if already redeemed (Cloned) logic?
                // Logic: check SharedItem where userId=me and sharedById=sender AND "linked to original"?
                // We don't link to original in Schema easily.
                // We just rely on "Did I already click this token?"
                // But token is generic.

                // For simplicity: ALWAYS CLONE NEW COPY.
                // Or check if we have a SharedItem from this token's original?
                // Hard to track "Which copy came from Item X".
                // Let's just create a new copy. "Fork".

                const newItem = await prisma.item.create({
                    data: {
                        content: original.content,
                        title: original.title,
                        imageUrl: original.imageUrl,
                        link: original.link,
                        location: original.location,
                        ownerId: userId,
                        // Clone tags
                        tags: {
                            create: original.tags.map(t => ({
                                tag: { connect: { id: t.tagId } }
                            }))
                        }
                    }
                });

                // Create SharedItem marker
                // @ts-ignore
                await prisma.sharedItem.create({
                    data: {
                        userId,
                        itemId: newItem.id, // Point to COPY
                        sharedById: senderId
                    }
                });

                // Capture share link redeemed event
                const posthog = getPostHogClient();
                posthog.capture({
                    distinctId: userId,
                    event: 'share_link_redeemed',
                    properties: {
                        type: 'ITEM',
                        original_item_id: shareToken.entityId,
                        new_item_id: newItem.id,
                        shared_by: senderId,
                    }
                });

                redirect(`/items/${newItem.id}`);
            }
            else if (shareToken.type === "LIST") {
                // Fetch Original List
                const originalList = await prisma.list.findUnique({
                    where: { id: shareToken.entityId },
                    include: { filterTags: true }
                });

                if (!originalList) throw new Error("Original list not found");

                // Clone List (forkedFromId tracks provenance)
                const newList = await prisma.list.create({
                    data: {
                        title: originalList.title,
                        ownerId: userId,
                        forkedFromId: originalList.id,
                        filterTags: {
                            create: originalList.filterTags.map(t => ({
                                tag: { connect: { id: t.tagId } }
                            }))
                        }
                    }
                });

                // Clone Items matching the tags
                // Find items owned by Sender that have at least one of the tags
                // Match existing items
                const tagIds = originalList.filterTags.map(t => t.tagId);
                const itemsToClone = await prisma.item.findMany({
                    where: {
                        ownerId: senderId,
                        tags: { some: { tagId: { in: tagIds } } }
                    },
                    include: { tags: true }
                });

                // Fetch Original Ranks
                // @ts-ignore
                const originalRanks = await prisma.itemRank.findMany({
                    where: {
                        // @ts-ignore
                        userId: senderId,
                        contextId: originalList.id,
                        itemId: { in: itemsToClone.map(i => i.id) }
                    }
                });
                const rankMap = new Map<string, string>();
                originalRanks.forEach((r: any) => rankMap.set(r.itemId, r.rank));

                // Create copies of items
                for (const item of itemsToClone) {
                    const clonedItem = await prisma.item.create({
                        data: {
                            content: item.content,
                            title: item.title,
                            imageUrl: item.imageUrl,
                            link: item.link,
                            location: item.location,
                            ownerId: userId,
                            tags: {
                                create: item.tags.map(t => ({
                                    tag: { connect: { id: t.tagId } }
                                }))
                            }
                        }
                    });

                    // Mark item as shared
                    // @ts-ignore
                    await prisma.sharedItem.create({
                        data: {
                            userId,
                            itemId: clonedItem.id,
                            sharedById: senderId
                        }
                    });

                    // Clone Rank?
                    if (rankMap.has(item.id)) {
                        // @ts-ignore
                        await prisma.itemRank.create({
                            data: {
                                userId,
                                contextId: newList.id,
                                itemId: clonedItem.id,
                                rank: rankMap.get(item.id)!
                            }
                        });
                    }
                }

                // Create SharedList record
                // @ts-ignore
                await prisma.sharedList.create({
                    data: {
                        userId,
                        listId: newList.id,
                        sharedById: senderId,
                        // @ts-ignore
                        permission: shareToken.permission || "READ"
                    }
                });

                // Capture share link redeemed event
                const posthog = getPostHogClient();
                posthog.capture({
                    distinctId: userId,
                    event: 'share_link_redeemed',
                    properties: {
                        type: 'LIST',
                        original_list_id: shareToken.entityId,
                        new_list_id: newList.id,
                        shared_by: senderId,
                        items_cloned: itemsToClone.length,
                    }
                });

                redirect(`/lists/${newList.id}`);
            }

        } catch (e) {
            // If redirect matches, let it pass
            if (String(e).includes("NEXT_REDIRECT")) throw e;
            console.error("Redemption failed", e);
            return <div>Error redeeming token: {String(e)}</div>;
        }
    }

    // 3. User NOT logged in -> Show "Join to View"
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--swiss-off-white)] p-4">
            <div className="bg-white p-8 rounded-lg border border-[var(--swiss-border)] shadow-sm max-w-md w-full text-center">
                <div className="mb-6">
                    {shareToken.creator.image ? (
                        <img src={shareToken.creator.image} alt={shareToken.creator.name || "User"} className="w-16 h-16 rounded-full mx-auto border-4 border-white shadow-sm" />
                    ) : (
                        <div className="w-16 h-16 rounded-full mx-auto bg-[var(--swiss-off-white)] flex items-center justify-center text-[var(--swiss-text-secondary)] text-xl font-bold border border-[var(--swiss-border)]">
                            {shareToken.creator.name?.[0] || "U"}
                        </div>
                    )}
                </div>

                <h1 className="text-2xl font-bold text-[var(--swiss-black)] mb-2">
                    {shareToken.creator.name} shared a {shareToken.type.toLowerCase()} with you!
                </h1>
                <p className="text-[var(--swiss-text-secondary)] mb-8">
                    To view this {shareToken.type.toLowerCase()}, you need to sign in or create an account.
                </p>

                <div className="space-y-4">
                    <Link
                        href={`/register?callbackUrl=/share/${token}`}
                        className="block w-full py-3 px-4 bg-[var(--swiss-black)] text-white rounded-lg font-medium hover:bg-[var(--swiss-accent-hover)] transition"
                    >
                        Create Account
                    </Link>
                    <Link
                        href={`/login?callbackUrl=/share/${token}`}
                        className="block w-full py-3 px-4 bg-white border border-[var(--swiss-border)] text-[var(--swiss-black)] rounded-lg font-medium hover:bg-[var(--swiss-off-white)] transition"
                    >
                        Log In
                    </Link>
                </div>
            </div>
        </div>
    );
}
