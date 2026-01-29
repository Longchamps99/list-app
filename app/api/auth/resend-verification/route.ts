import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";
import { z } from "zod";
import { emailLimiter } from "@/lib/ratelimit";

const resendSchema = z.object({
    email: z.string().email(),
});

export async function POST(req: NextRequest) {
    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await emailLimiter.limit(ip);

    if (!success) {
        return NextResponse.json(
            { message: "Too many requests. Please check your email or try again in an hour." },
            { status: 429 }
        );
    }

    try {
        const body = await req.json();
        const { email } = resendSchema.parse(body);

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // We return 200 even if user not found to avoid email enumeration
            return NextResponse.json({ message: "If an account exists, a new verification link has been sent." });
        }

        if (user.emailVerified) {
            return NextResponse.json({ message: "Email is already verified." });
        }

        // Delete any existing tokens for this user
        await prisma.verificationToken.deleteMany({
            where: { identifier: email },
        });

        // Generate new token
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token,
                expires,
            },
        });

        // Send email
        await sendVerificationEmail(email, token);

        return NextResponse.json({ message: "A new verification link has been sent to your email." });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
