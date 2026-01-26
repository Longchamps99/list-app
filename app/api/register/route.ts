import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(req: Request) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password) {
            return new NextResponse("Missing email or password", { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return new NextResponse("User already exists", { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
            },
        });

        // Capture server-side signup event
        const posthog = getPostHogClient();
        posthog.capture({
            distinctId: email,
            event: 'user_signed_up',
            properties: {
                email: email,
                name: name,
                source: 'api',
            }
        });

        // Identify user on server side
        posthog.identify({
            distinctId: email,
            properties: {
                email: email,
                name: name,
                createdAt: new Date().toISOString(),
            }
        });

        return NextResponse.json(user);
    } catch (error) {
        // Capture registration error
        const posthog = getPostHogClient();
        posthog.capture({
            distinctId: 'anonymous',
            event: 'registration_error',
            properties: {
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        });
        return new NextResponse("Internal Error", { status: 500 });
    }
}
