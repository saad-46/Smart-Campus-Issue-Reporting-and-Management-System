# Registration, roles and one-time-code verification

## What a person sees

The create-account page offers three roles in the same card style:

| Card | Meaning | What it creates |
| --- | --- | --- |
| **Report issues** (Student) | Reports problems, follows them | A plain student account. College, roll number, academic year and branch are required |
| **Resolve issues** (Maintenance staff) | Works on maintenance tasks | A plain account **plus a worker request** and the team (`workArea`) they work with. An administrator approves it once; after that everyday work needs no administrator |
| **Manage campus** (Administrator) | Runs campus operations | A plain account **plus an administrator request**. An existing administrator approves it on the server; nothing is granted by choosing the card |

Every role gives a name, **email**, **phone number** and a 6-digit PIN, and must **verify either the email or the phone** with a one-time code before the account can be created. The other contact is still required and stored, but is not marked verified.

College and Branch are searchable lists: they open when focused or clicked, rank prefix matches first, work with the keyboard (arrows, Enter, Escape, Tab) and never accept stray text. "My institution / branch isn't listed" is an explicit choice that reveals a text field.

## Data behind the lists

- **Colleges**: `data/campuses/sues-hyderabad/institutions.json` (the institutions on the SUES campus). Add an institution there and it appears.
- **Branches**: `data/academics.json`. MJCET's list follows <https://www.mjcollege.ac.in/about-mjcet> (checked 2026-10-24; earlier programmes that older documents list are included and marked "Earlier programme"). Pharmacy, Law, Business Administration and Education carry one entry named after the institution. Colleges without a sourced list (junior college, school) use the "isn't listed" text path instead of an invented list. Every entry has a source and a review date; a test checks them.
- Nothing is fetched at runtime, so registration never depends on a third-party service.

## How verification works

```text
EMAIL                                                          PHONE
browser --POST /api/otp/email/send--> server                   browser --Firebase Phone Auth--> SMS
          emails a 6-digit code (provider)                               confirm code -> signed in as the phone
browser --POST /api/otp/email/verify--> server                 link email + PIN to that same account
          checks the code -> one-time ticket
browser creates the account (email + PIN)
browser --POST /api/register/complete + ticket--> server
          spends the ticket, sets claim contactVerified="email"
browser writes the profile ------------------------------>  firestore.rules require the claim (email)
                                                            or Firebase's phone_number (phone)
```

- **Codes** are generated on the server (`crypto.randomInt`), never stored in the clear (only an HMAC bound to the challenge id and the address), valid 10 minutes, 5 wrong attempts then locked, single use. A new code does not unlock an old challenge.
- **Limits**: 60 s between codes to one address, 5 codes per address per hour, 20 per caller address per hour. Responses are identical whether or not an account exists; no OTP value is ever logged or returned.
- **Binding**: the ticket only works for the address that was verified, once, within 15 minutes, for a caller whose ID token carries that same email. Editing the email (or phone) on the page throws away the verification.
- **No bypass**: `firestore.rules` accept a new profile only if the token carries the server-set `contactVerified: "email"` claim for the profile's email, or Firebase's own `phone_number` claim equal to the profile's phone. A client that skips the page (a hand-made request) has neither and is refused (tested).
- **Server-only data**: `otpChallenges`, `registrationTickets`, `otpLimits` (and `__otpCapture`, tests only) match no rule, so no browser can read or write them.
- **Administrator approval**: `POST /api/admin/admin-access` checks the caller has an `admins/{uid}` document (Admin SDK), that the target has a pending request and a verified contact, and then creates `admins/{target}`. `admins` stays closed to every client. The requester cannot approve themselves; a second approval is refused (409).

## Configuration (names only; never commit values)

| Variable | Where | Purpose |
| --- | --- | --- |
| `OTP_SECRET` | server | Random string of 32+ characters that keys every code/ticket hash. Required |
| `OTP_EMAIL_PROVIDER` | server | `resend` for real delivery |
| `RESEND_API_KEY` | server (sensitive) | Resend API key |
| `OTP_EMAIL_FROM` | server | Verified sender, e.g. `UniFix <no-reply@your-domain>` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | server (sensitive) | Service-account key as one JSON string, for the Admin SDK |
| `NEXT_PUBLIC_PHONE_OTP_ENABLED` | build time | `true` shows SMS verification and allows reCAPTCHA in the CSP. Leave unset until SMS is set up |

Without `OTP_SECRET`, a provider and the service account, the send/verify routes answer 503 ("Email verification isn't available right now") and **no one can register**. This is deliberate: there is no fallback that would let an unverified account through.

### Email (Resend, or any provider you wire into `lib/server/mailer.ts`)

1. Create a Resend account and verify a sending domain (a sender on a domain you control is needed to reach arbitrary inboxes). Free tier limits apply; check pricing and quotas.
2. Create an API key; set `RESEND_API_KEY`, `OTP_EMAIL_FROM`, `OTP_EMAIL_PROVIDER=resend`.
3. Create a Firebase service account key (Project settings -> Service accounts), paste the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`. Grant it only the default Firebase Admin role.
4. Set `OTP_SECRET` (e.g. `openssl rand -hex 32`).
5. In Vercel, add these for Production (mark keys sensitive), redeploy.

### Phone (optional)

1. Firebase console -> Authentication -> Sign-in method -> enable **Phone**. SMS may require the Blaze plan and has regional/quota limits: check Firebase's current pricing before enabling. Add the production domain under Authorized domains and set an SMS region policy.
2. Set `NEXT_PUBLIC_PHONE_OTP_ENABLED=true` and redeploy (it changes the CSP to allow Google reCAPTCHA).
3. Registration uses Firebase's own invisible reCAPTCHA; a number that already has an account is refused.

### Housekeeping

Expired OTP rows are harmless but accumulate. In the Firebase console add Firestore **TTL policies** on `otpChallenges.expiresAt`, `registrationTickets.expiresAt` and `otpLimits.resetAt`. No composite index is required.

## Firestore rules change (not yet deployed)

`users/{uid}` creation now requires: `phone` (E.164), `verifiedVia` (`email`|`phone`) with the matching proof above; student details (all four) **unless** a worker or administrator request is present, in which case the student fields are refused; `workerRequest` needs a `workArea` from the department list; `adminRequest` can only be `pending`; a request is never both. A worker may change their own `workArea` (to a known team). Roles, grants and admin writes are unchanged.

**The rules and the app cannot be swapped in one step, so there is a short window in which new registrations fail** (existing people can still sign in and work). The old rules refuse the new page's profile (it carries `phone` and `verifiedVia`); the new rules refuse the old page's profile (no proof). Plan it:

1. First make everything else ready: provider, `OTP_SECRET` and the service account set in Vercel, an app preview deployed and checked with the checklist below against a **test** Firebase project or the emulators.
2. Pick a quiet time. Save the live rules (a rollback copy of the previous ruleset is kept in `unifix-production-backups`), run the rules tests.
3. Deploy the **rules**, then promote the **app** straight after (or the reverse). Registration is unavailable between the two steps (a person who hits it ends with an account but no profile; registering again with the same email and PIN finishes it). Then run the checklist.

Rollback: redeploy the previous app version in Vercel and restore the saved rules file (deploy it) together; either alone leaves registration refused until both match. Sign-in and everyday work are unaffected by either.

Accounts created earlier are unaffected (their profiles exist). An account whose registration was interrupted before this release has no profile; registering again with the same email and PIN finishes it.

## Manual production checklist

1. Student: register with a real inbox, receive the email, verify, finish. Dashboard shows the details; no "Add your student details" banner.
2. Student: register, verify by phone only (if enabled). Email + PIN then sign in.
3. Wrong code x5 -> locked; resend after the cooldown; a code from an old email is refused after changing the address.
4. Worker: register with a team, sign in as Worker (waiting message), approve as an administrator, sign in again; the pool lists that team first.
5. Administrator: register as Manage campus, sign in as Admin (waiting message), approve from the overview as an existing administrator, sign in.
6. Confirm no OTP appears in Vercel logs; confirm rate-limit responses (429) after repeated sends.

## Preview / test environment (free)

Preview deployments of the branch `feat/registration-roles-otp` use the separate Firebase project `unifix-otp-test`, never production.

- **Isolation.** Branch-scoped Preview variables (names only): `NEXT_PUBLIC_FIREBASE_*` (the test project's web app), `FIREBASE_SERVICE_ACCOUNT_JSON` (a key for `unifix-test-admin-sdk`, roles `datastore.user` and `firebaseauth.admin` only), `OTP_SECRET`, `OTP_EMAIL_PROVIDER=resend`, `OTP_EMAIL_FROM`, `RESEND_API_KEY`, `NEXT_PUBLIC_PHONE_OTP_ENABLED=true`, `NEXT_PUBLIC_TEST_PHONE_NUMBERS`. Production variables are separate entries. `lib/server/admin.ts` refuses to start if the service account's project differs from `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and there is no fallback to other credentials.
- **Email.** Resend's shared test sender `onboarding@resend.dev` only delivers to the email address of the Resend account that owns the API key, so register with that address. No domain is needed and nothing is charged. Code generation, expiry, attempts and single use are the production code.
- **Phone.** The Phone provider is enabled in the test project with one fictional number (listed in `NEXT_PUBLIC_TEST_PHONE_NUMBERS`, code in the Firebase console under Authentication > Sign-in method > Phone). No SMS is sent for it. The test code works only for that number, only in that project; the SMS region allowlist is empty, so real numbers cannot be sent texts, and the project has no billing. The variable only adds a label in the UI; it grants nothing.
- **Authorised domains.** Add the Preview hostname under Authentication > Settings > Authorised domains of the test project (needed by reCAPTCHA).
- **Not verified here:** real SMS delivery (needs billing, deliberately not enabled).

## Known limits

- Delivery depends on the provider; a code that cannot be sent voids its challenge and the person can retry.
- Limits are per address and per caller address (as the platform reports it) in fixed one-hour windows.
- SMS cost and availability are Firebase's; a number already registered cannot be used again.
- Tests use the local emulators with a capture transport that the server refuses outside the emulators; real delivery has not been exercised from this repository.
