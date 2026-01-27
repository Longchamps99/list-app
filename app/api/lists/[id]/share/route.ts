import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { email } = await req.json();
        const targetEmail = email.trim();

        if (targetEmail === user.email) {
            return new NextResponse("Cannot share with yourself", { status: 400 });
        }

        // Find target user (or create)
        const targetUser = await prisma.user.upsert({
            where: { email: targetEmail },
            update: {},
            create: {
                email: targetEmail,
                name: targetEmail.split('@')[0]
            }
        });

        // Create Share Record
        await prisma.sharedList.upsert({
            where: {
                userId_listId: {
                    userId: targetUser.id,
                    listId: id
                }
            },
            create: {
                userId: targetUser.id,
                listId: id
            },
            update: {}
        });

        return NextResponse.json({ success: true, user: targetUser });
    } catch (e) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
