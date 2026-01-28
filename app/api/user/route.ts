import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // @ts-ignore - user.id is added in session callback
        const userId = user.id;

        if (!userId) {
            return new NextResponse("User ID not found", { status: 400 });
        }

        // Delete user - Prisma will cascade delete all related records
        // due to onDelete: Cascade in schema
        await prisma.user.delete({
            where: { id: userId }
        });

        return NextResponse.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
        console.error("[DELETE /api/user] Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
