import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";
import { authLimiter } from "@/lib/ratelimit";

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export async function POST(req: NextRequest) {
    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success, limit, reset, remaining } = await authLimiter.limit(ip);

    if (!success) {
        return NextResponse.json(
            { message: "Too many registration attempts. Please try again later." },
            {
                status: 429,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Remaining": remaining.toString(),
                    "X-RateLimit-Reset": reset.toString(),
                }
            }
        );
    }

    try {
        const body = await req.json();
        const { email, password } = registerSchema.parse(body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { message: "A user with this email already exists." },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (auto-verify on localhost)
        const isLocal = process.env.NODE_ENV === 'development';
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                emailVerified: isLocal ? new Date() : null,
            },
        });

        // Generate verification token
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token,
                expires,
            },
        });

        // Send verification email
        try {
            await sendVerificationEmail(email, token);
        } catch (emailError) {
            console.error("Failed to send verification email during registration:", emailError);
            // We don't fail registration if email fails, but we should inform user
            // or allow them to resend.
        }

        return NextResponse.json(
            {
                message: isLocal
                    ? "Registration successful! (Auto-verified for local development)"
                    : "Registration successful. Please check your email to verify your account.",
                userId: user.id
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
        }
        console.error("Registration error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
