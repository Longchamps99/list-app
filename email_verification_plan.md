# Implementation Plan: Email Verification

## 1. Goal
Implement a robust email verification system to ensure users own the email addresses they register with. This is critical for security, communication, and reducing bot registrations.

## 2. User Experience Flows

### A. Happy Path: New Registration
1.  **Registration**: User fills out email/password at `/register`.
2.  **Account Created**: 
    -   Backend hashes password.
    -   User record created with `emailVerified: null`.
    -   Verification token generated and stored in `VerificationToken` table.
3.  **Email Sent**: Transactional email sent via **Resend** with a link to `https://vaultedfaves.com/verify?token=[TOKEN]`.
4.  **Pending State**: User is redirected to `/verify-email-pending?email=[EMAIL]`.
5.  **Verification**: User clicks the email link.
6.  **Success**:
    -   Backend validates token + expiry.
    -   `User.emailVerified` updated to current timestamp.
    -   User redirected to `/dashboard` with a success message.

### B. Unhappy Paths & Recovery

| Scenario | UX Handling | Technical Recovery |
| :--- | :--- | :--- |
| **Expired Link** | Show "Link Expired" page with a "Resend Email" button. | Delete old token, generate new one, resend mail. |
| **Invalid Token** | Show "Invalid Link" error with a link back to support or registration. | Return 400 error from verification API. |
| **Already Verified** | Redirect to `/dashboard` with toast: "Email already verified." | Check `emailVerified` field before processing token. |
| **Resend Request** | User clicks "Didn't get an email?" on the pending page. | Rate-limit requests and trigger new email sending. |
| **Sign-in Attempt (Unverified)** | If user tries to login before verifying, redirect to `/verify-email-pending`. | Middleware check or Auth callback check. |

### C. OAuth (Google) Path
Users signing up via Google will have their emails **auto-verified** if the provider confirms verification, ensuring no friction for social logins.

---

## 3. Technical Requirements

### 1. Database Updates
-   NextAuth already has `emailVerified: DateTime?` and `VerificationToken` model in `schema.prisma`.
-   Verify these are ready (Done: verified in previous step).

### 2. New API Endpoints
-   `POST /api/auth/register`: 
    -   Validates inputs (Zod).
    -   Checks for existing user.
    -   Hashes password (bcrypt).
    -   Creates User + VerificationToken.
    -   Triggers email.
-   `POST /api/auth/resend-verification`:
    -   Rate-limited endpoint to resend mail.

### 3. Verification Page
-   `app/verify/page.tsx`:
    -   Server component that reads `token` from searchParams.
    -   Calls verification logic.
    -   Redirects to success or error state.

### 4. Email Service: Resend
-   **Why**: Modern API, easy setup, reliable delivery.
-   **Setup**: Requires `RESEND_API_KEY` in `.env`.

### 5. Middleware / Auth Protection
-   Update `callbacks` in `lib/auth.ts` to check if `user.emailVerified` is set before allowing session creation for `credentials` provider.
-   Add `middleware.ts` to redirect authenticated but unverified users from sensitive routes.

---

## 4. Proposed Timeline
1.  **Step 1**: Setup Resend and Email utility (`lib/email.ts`).
2.  **Step 2**: Create Registration API and update Register Page UI.
3.  **Step 3**: Implement Verification Logic and Success/Error UI.
4.  **Step 4**: Add Protection (Middleware/Callbacks) to enforce verification.
