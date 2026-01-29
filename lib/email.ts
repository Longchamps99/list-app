import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const domain = process.env.NEXTAUTH_URL || "https://vaultedfaves.com";

export const sendVerificationEmail = async (email: string, token: string) => {
    const confirmLink = `${domain}/verify?token=${token}`;

    console.log(`Sending verification email to ${email} with link: ${confirmLink}`);

    const { data, error } = await resend.emails.send({
        from: "Vaulted <onboarding@vaultedfaves.com>",
        to: email,
        subject: "Verify your email for Vaulted",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                <h1 style="color: #4f46e5;">Welcome to Vaulted!</h1>
                <p style="font-size: 16px; line-height: 1.5;">
                    Thanks for joining Vaulted. Before you can start curating your legacy, we need you to verify your email address.
                </p>
                <div style="margin: 30px 0;">
                    <a href="${confirmLink}" 
                       style="background-color: #4f46e5; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p style="font-size: 14px; color: #666;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #999;">
                    Vaulted App • Curate Your Legacy
                </p>
            </div>
        `,
    });

    if (error) {
        console.error("Failed to send verification email:", error);
        throw new Error(error.message);
    }

    return data;
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const resetLink = `${domain}/reset-password?token=${token}`;

    console.log(`Sending password reset email to ${email} with link: ${resetLink}`);

    const { data, error } = await resend.emails.send({
        from: "Vaulted <onboarding@vaultedfaves.com>",
        to: email,
        subject: "Reset your password for Vaulted",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                <h1 style="color: #4f46e5;">Password Reset Request</h1>
                <p style="font-size: 16px; line-height: 1.5;">
                    Someone requested a password reset for your Vaulted account. If this was you, click the button below to set a new password.
                </p>
                <div style="margin: 30px 0;">
                    <a href="${resetLink}" 
                       style="background-color: #4f46e5; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="font-size: 14px; color: #666;">
                    This link will expire in 2 hours. If you didn't request a reset, you can safely ignore this email.
                </p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #999;">
                    Vaulted App • Curate Your Legacy
                </p>
            </div>
        `,
    });

    if (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error(error.message);
    }

    return data;
};
