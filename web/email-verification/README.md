# Folio — email verification status page

Static verification-result page for Folio, hosted on Vercel at:
https://folio-verification-page.vercel.app

## What it does

- Reads the session access token returned after Supabase confirms an email via `{{ .ConfirmationURL }}`.
- Immediately removes tokens and error data from the browser's visible URL.
- Calls `GET /auth/v1/user` with Folio's **publishable** API key and the session token.
- Shows **Email verified!** only when the Supabase Auth server returns a valid user whose `email_confirmed_at` is populated.
- Handles invalid links, expired links, network errors, missing result, and unconfirmed accounts.
- Never persists or displays tokens. No external JavaScript dependencies.

The Supabase project URL and publishable API key in this page are designed to be public. Never place a `service_role`, `sb_secret_...` key, SMTP password, or other server secret in this page.

## Deploy update to existing Vercel project

Vercel Drop creates a **new project** for a new upload. To preserve the existing `folio-verification-page.vercel.app` URL, update the existing Vercel project instead:

1. Unzip this package and open Terminal in its `folio-verification-secure` folder.
2. Run `npx vercel link` and select the **existing** Folio verification-page project.
3. Run `npx vercel --prod` to deploy the update to that same project.
4. Open https://folio-verification-page.vercel.app directly: it should say **No verification result**.
5. Register a **new** test user and click their confirmation email button. The page should show **Email verified!**, and the user should be marked as confirmed in Supabase.

Keep the Supabase confirmation template using `{{ .ConfirmationURL }}` and retain the Vercel URL in your Supabase allowed Redirect URLs. A new account test is necessary because confirmation links are generally single-use.

**Note:** The current Folio signup uses Supabase's default implicit redirect. If it is later changed to PKCE or to a custom token-hash email link, the verification page must be updated to handle that flow appropriately.
