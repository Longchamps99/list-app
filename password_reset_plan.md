# Implementation Plan: Password Reset

## 1. Goal
Provide a secure way for users to regain access to their accounts if they forget their passwords.

## 2. User Experience Flows

### A. Phase 1: Requesting a Reset
1.  **User Trigger**: User clicks "Forgot Password?" on the login page.
2.  **Request Page**: User enters their email at `/forgot-password`.
3.  **Security**:
    -   Apply rate limiting (using `authLimiter`).
    -   Show a generic success message even if the email doesn't exist (to prevent user enumeration).
4.  **Backend**:
    -   Generate a secure random reset token (e.g., 32-character hex).
    -   Store token in `PasswordResetToken` table with a 2-hour expiration.
    -   Delete any existing reset tokens for that email.
5.  **Email**: Send a transactional email via Resend with a link: `https://vaultedfaves.com/reset-password?token=[TOKEN]`.

### B. Phase 2: Resetting the Password
1.  **Reset Page**: User clicks the link in their email and lands on `/reset-password?token=[TOKEN]`.
2.  **Validation**:
    -   Verify the token exists and hasn't expired.
    -   Verify the user is not trying to use a verification token for a password reset.
3.  **New Password**: User enters and confirms a new password (min 6 characters).
4.  **Execution**:
    -   Hash the new password (bcrypt).
    -   Update the `User` record.
    -   Delete the reset token.
    -   Notify the user of success and redirect to `/login`.

---

## 3. Technical Requirements

### 1. Database Schema
Add `PasswordResetToken` model:
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())

  @@unique([email, token])
}
```

### 2. API Endpoints
-   `POST /api/auth/forgot-password`: Validate email, create token, send email.
-   `POST /api/auth/reset-password`: Validate token, hash password, update DB.

### 3. Email Template
Update `lib/email.ts` with a `sendPasswordResetEmail` function.

### 4. UI Components
-   `app/forgot-password/page.tsx`: Simple email input form.
-   `app/reset-password/page.tsx`: Password reset form with validation.

---

## 4. Graceful Error Handling
| Scenario | UX Handling |
| :--- | :--- |
| **Expired Reset Link** | Show "Link Expired" with a link back to `/forgot-password`. |
| **Invalid Token** | Show "Invalid Link" error. |
| **Password Too Weak** | Frontend and backend validation for minimum length. |
| **Email Failure** | Log error but don't expose it to the user; provide resend capability. |
