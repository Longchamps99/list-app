import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Header } from "../components/Header";
import { Star, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { OnboardingHandler } from "./OnboardingHandler";

export default async function VerifyPage(props: {
    searchParams: Promise<{ token: string }>;
}) {
    const searchParams = await props.searchParams;
    const token = searchParams.token;

    if (!token) {
        return (
            <VerificationLayout
                title="Invalid Link"
                message="The verification link is missing or malformed."
                status="error"
            />
        );
    }

    try {
        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token },
        });

        if (!verificationToken) {
            return (
                <VerificationLayout
                    title="Invalid Link"
                    message="This verification link is invalid or has already been used."
                    status="error"
                />
            );
        }

        if (verificationToken.expires < new Date()) {
            return (
                <VerificationLayout
                    title="Link Expired"
                    message="Your verification link has expired. Please try registering again or requesting a new link."
                    status="error"
                />
            );
        }

        // Update user
        await prisma.user.update({
            where: { email: verificationToken.identifier },
            data: { emailVerified: new Date() },
        });

        // Delete the token
        await prisma.verificationToken.delete({
            where: { token },
        });

        return (
            <VerificationLayout
                title="Email Verified!"
                message="Your email has been successfully verified. We're setting up your account..."
                status="success"
                userEmail={verificationToken.identifier}
            />
        );
    } catch (error) {
        console.error("Verification error:", error);
        return (
            <VerificationLayout
                title="Verification Failed"
                message="An unexpected error occurred during verification. Please try again later."
                status="error"
            />
        );
    }
}

function VerificationLayout({
    title,
    message,
    status,
    userEmail
}: {
    title: string;
    message: string;
    status: 'success' | 'error';
    userEmail?: string;
}) {
    return (
        <div className="min-h-screen bg-[var(--swiss-off-white)] text-[var(--swiss-black)] flex flex-col">
            <Header variant="page" title="Verify Email" showBack={false} />

            <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-white border border-[var(--swiss-border)] rounded-lg shadow-sm p-8">
                        <div className="mb-6 flex justify-center">
                            {status === 'success' ? (
                                <div className="w-16 h-16 bg-[var(--swiss-green-light)] rounded-full flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-[var(--swiss-green)]" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-[var(--swiss-red-light)] rounded-full flex items-center justify-center">
                                    <XCircle className="h-8 w-8 text-[var(--swiss-red)]" />
                                </div>
                            )}
                        </div>

                        <h1 className="text-3xl font-bold text-[var(--swiss-black)] mb-4">{title}</h1>
                        <p className="text-[var(--swiss-text-muted)] mb-8">{message}</p>

                        {userEmail && <OnboardingHandler userEmail={userEmail} />}

                        <div className="space-y-4">
                            {status === 'success' && !userEmail && (
                                <Link
                                    href="/login"
                                    className="flex items-center justify-center gap-2 w-full bg-[var(--swiss-black)] px-6 py-4 rounded-lg text-base font-bold text-white hover:bg-[var(--swiss-accent-hover)] transition-all"
                                >
                                    Continue to Login
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                            )}
                            {status === 'error' && (
                                <Link
                                    href="/register"
                                    className="flex items-center justify-center gap-2 w-full bg-white hover:bg-[var(--swiss-off-white)] border border-[var(--swiss-border)] px-6 py-4 rounded-lg text-base font-bold text-[var(--swiss-black)] transition-all"
                                >
                                    Return to Registration
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
