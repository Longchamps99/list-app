import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetPasswordSchema = z.object({
    token: z.string(),
    password: z.string().min(6),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, password } = resetPasswordSchema.parse(body);

        // Find token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            return NextResponse.json(
                { message: "Invalid or expired reset token." },
                { status: 400 }
            );
        }

        if (resetToken.expires < new Date()) {
            await prisma.passwordResetToken.delete({ where: { token } });
            return NextResponse.json(
                { message: "Reset token has expired." },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        await prisma.user.update({
            where: { email: resetToken.email },
            data: { password: hashedPassword },
        });

        // Delete token
        await prisma.passwordResetToken.delete({ where: { token } });

        return NextResponse.json({ message: "Password has been successfully reset." });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
        }
        console.error("Reset password error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
