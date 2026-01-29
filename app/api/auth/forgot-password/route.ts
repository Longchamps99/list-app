import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { authLimiter } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await authLimiter.limit(ip);

    if (!success) {
        return NextResponse.json(
            { message: "Too many attempts. Please try again later." },
            { status: 429 }
        );
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ message: "Email is required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        // We return a success message even if the user doesn't exist for security
        if (!user || !user.password) {
            return NextResponse.json({
                message: "If an account exists with this email, a reset link has been sent."
            });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

        // Delete old tokens and create new one
        await prisma.passwordResetToken.deleteMany({
            where: { email },
        });

        await prisma.passwordResetToken.create({
            data: {
                email,
                token,
                expires,
                userId: user.id,
            },
        });

        // Send email
        await sendPasswordResetEmail(email, token);

        return NextResponse.json({
            message: "If an account exists with this email, a reset link has been sent."
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
