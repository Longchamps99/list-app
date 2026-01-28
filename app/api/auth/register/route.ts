import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export async function POST(req: NextRequest) {
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

        // Create user (unverified)
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                emailVerified: null,
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
            { message: "Registration successful. Please check your email to verify your account.", userId: user.id },
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
