import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { sendCollaborationEmail } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;
    // @ts-ignore
    const userName = user.name || "A Vaulted User";

    try {
        // Verify current user owns the list
        const list = await prisma.list.findUnique({
            where: { id },
            select: { ownerId: true, title: true }
        });

        if (!list) {
            return new NextResponse("List not found", { status: 404 });
        }

        if (list.ownerId !== userId) {
            return new NextResponse("Only the list owner can invite collaborators", { status: 403 });
        }

        const { email, permission = 'WRITE' } = await req.json();
        const targetEmail = email.trim().toLowerCase();

        if (targetEmail === user.email?.toLowerCase()) {
            return new NextResponse("Cannot invite yourself", { status: 400 });
        }

        // Validate permission
        if (!['READ', 'WRITE'].includes(permission)) {
            return new NextResponse("Invalid permission. Must be 'READ' or 'WRITE'", { status: 400 });
        }

        // Find or create target user
        const targetUser = await prisma.user.upsert({
            where: { email: targetEmail },
            update: {},
            create: {
                email: targetEmail,
                name: targetEmail.split('@')[0]
            }
        });

        // Create or update SharedList entry for live collaboration
        // @ts-ignore - permission field exists after migration
        await prisma.sharedList.upsert({
            where: {
                userId_listId: {
                    userId: targetUser.id,
                    listId: id
                }
            },
            create: {
                userId: targetUser.id,
                listId: id,
                sharedById: userId,
                permission: permission
            },
            update: {
                permission: permission
            }
        });

        // Send email notification
        await sendCollaborationEmail(targetEmail, userName, list.title, id);


        return NextResponse.json({
            success: true,
            user: { id: targetUser.id, email: targetUser.email },
            permission
        });
    } catch (e) {
        console.error("[Invite API] Error:", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// GET: List all collaborators for a list
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        // Check if user has access to the list
        const list = await prisma.list.findUnique({
            where: { id },
            include: {
                shares: {
                    where: { userId }
                }
            }
        });

        if (!list) {
            return new NextResponse("List not found", { status: 404 });
        }

        const hasAccess = list.ownerId === userId || list.shares.length > 0;
        if (!hasAccess) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Get all collaborators
        // @ts-ignore - permission field exists
        const collaborators = await prisma.sharedList.findMany({
            where: { listId: id },
            include: {
                user: {
                    select: { id: true, email: true, name: true, image: true }
                }
            }
        });

        return NextResponse.json(collaborators);
    } catch (e) {
        console.error("[Invite API] Error:", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE: Remove a collaborator
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // @ts-ignore
    const userId = user.id;

    try {
        const { collaboratorUserId } = await req.json();

        // Verify current user owns the list
        const list = await prisma.list.findUnique({
            where: { id },
            select: { ownerId: true }
        });

        if (!list) {
            return new NextResponse("List not found", { status: 404 });
        }

        if (list.ownerId !== userId) {
            return new NextResponse("Only the list owner can remove collaborators", { status: 403 });
        }

        await prisma.sharedList.delete({
            where: {
                userId_listId: {
                    userId: collaboratorUserId,
                    listId: id
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("[Invite API] Error:", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
