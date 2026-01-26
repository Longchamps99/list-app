import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { type, id } = await req.json();
        // @ts-ignore
        // @ts-ignore
        const userId = session.user.id;
        console.log("[ShareAPI] Request:", { type, id, userId });

        if (!type || !id || (type !== "ITEM" && type !== "LIST")) {
            console.log("[ShareAPI] Invalid input");
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        // Verify ownership
        if (type === "ITEM") {
            const item = await prisma.item.findUnique({ where: { id } });
            console.log("[ShareAPI] Item found:", item ? { id: item.id, owner: item.ownerId } : "null");

            // @ts-ignore
            if (!item) {
                console.log("[ShareAPI] Item not found");
                return NextResponse.json({ error: "Item not found" }, { status: 404 });
            }
            // @ts-ignore
            // @ts-ignore
            if (item.ownerId !== session.user.id) {
                // Check if shared with me
                // @ts-ignore
                const isSharedWithMe = await prisma.sharedItem.findFirst({
                    where: {
                        itemId: id,
                        // @ts-ignore
                        // @ts-ignore
                        userId: session.user.id
                    }
                });

                if (!isSharedWithMe) {
                    // @ts-ignore
                    const msg = `Unauthorized: Owner mismatch. ItemOwner: '${item.ownerId}' vs YourID: '${session.user.id}'`;
                    console.log(`[ShareAPI] ${msg}`);
                    return NextResponse.json({ error: msg }, { status: 404 });
                }
            }
        } else {
            const list = await prisma.list.findUnique({ where: { id } });
            // @ts-ignore
            // @ts-ignore
            if (!list || list.ownerId !== session.user.id) {
                console.log("[ShareAPI] List ownership failed");
                return NextResponse.json({ error: "List not found or unauthorized" }, { status: 404 });
            }
        }

        // Generate a clean, short token (12 chars hex = 6 bytes)
        const token = crypto.randomBytes(6).toString("hex");

        await prisma.shareToken.create({
            data: {
                token,
                type,
                entityId: id,
                // @ts-ignore
                // @ts-ignore
                creatorId: session.user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
            }
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const url = `${baseUrl}/share/${token}`;

        return NextResponse.json({ url });

    } catch (e) {
        console.error("Share generation failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
