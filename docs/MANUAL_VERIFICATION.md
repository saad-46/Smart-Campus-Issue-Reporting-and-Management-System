# Manual verification checklist

What automation could not verify, and how a person can. Everything else is covered by the automated suites listed in `SMART_CAMPUS_FINAL_AUDIT.md`.

**Do not use, approve, reject, pay, edit or delete the existing pending expense claim (₹1,046) for any of this.** Use only records you create during the test.

## A. Signed-in production smoke test

**Environment:** <https://smart-campus-unifix.vercel.app/>, a desktop browser. (Legacy address, not yet retired: `smart-campus-issue-reporting-and-ma.vercel.app`; see section C.)

**Test identities (create them for this purpose; do not use personal accounts of other people):**

- one student account (register normally and verify the e-mail);
- one worker account (register as a worker, then approve it from the admin account);
- one admin account (an existing administrator; admins are granted only in the Firebase console under `admins/{uid}`).

| # | Step | Expected |
| --- | --- | --- |
| 1 | Student: sign in, open **Report an issue**, pick **Campus place → Block 4**, add a landmark, submit a clearly labelled test report ("TEST – please ignore") | Redirect to the issue page; the issue is listed under **My issues** |
| 2 | Student: send a message in **Discussion** | It appears, and still appears after a reload |
| 3 | Admin: open the test issue, **Assign** the test worker, then **Escalate** and **Clear escalation** | The worker's name shows; the timeline records the assignment; the worker gets a notification |
| 4 | Admin: open **Campus map** | The test issue is counted at "Blocks 3 and 4 area"; labels do not overlap |
| 5 | Worker: sign in, open **My work**, **Start work**, then resolve **without** an expense claim | Status moves Open → In Progress → Resolved; the student gets a notification |
| 6 | Student: rate the fix | One rating is accepted; a second is refused |
| 7 | Worker (optional, only on the test issue): resolve a second test issue **with** a small claim and a receipt photo. Admin: open **Finance**, review **that** claim and **reject** it | The claim leaves the pending list; the student who reported the issue never sees the receipt |
| 8 | Student: try to open `/admin` and `/worker` | Redirected to the student dashboard |
| 9 | While signed in, open `/viewer` | Only sample issues (`SC-…`) are shown; nothing you did in steps 1–7 appears |
| 10 | Sign out, then open `/dashboard`, `/admin`, `/issues/<the test issue id>` | Redirected to sign-in each time |

Record the date, the accounts used and the result of each step in `SMART_CAMPUS_FINAL_AUDIT.md`.

## B. QR code on a real phone

**Status: not done.** No physical phone or camera was available to the automated runs, so no real scan has been verified. The link a scan opens, and every refusal case, is covered by `tests/unit/qr.test.ts`, `e2e/qr.spec.ts` (Explore) and `e2e/signed-in.emulator.spec.ts` (signed in, emulators).

**Which code:** use a code the app generated, from **Locations & QR** (signed in as admin, or `/viewer/locations` in Explore). The researched locations already exist there, for example **Seminar Hall, Block 4** (`mjcet-seminar-hall`) or **Block 4** (`mjcet-block-4`). Do not draw a code by hand or from a third-party generator.

**Environment:** the live site, a phone with a camera, and for the real flow the test student account from section A.

| # | Step | Expected |
| --- | --- | --- |
| 1 | Explore: on a desktop open `/viewer/locations`, click **Seminar Hall, Block 4**, scan the code on the screen with the phone's camera app | The phone opens `…/viewer/report?location=mjcet-seminar-hall`. The form shows **Seminar Hall, Block 4** and "Approximate position". No sign-in is asked for |
| 2 | Submit "TEST – please ignore" | "Demo report submitted". Nothing is saved; reloading removes it |
| 3 | Real flow: signed in as admin on a desktop, open **Locations & QR**, **Add location** "TEST QR" with map place "Blocks 3 and 4 area", open its code and scan it on the phone | The phone opens `…/dashboard/report?location=blocks-3-4-test-qr` (after sign-in as the test student if asked). The form shows "TEST QR" under "From the QR code you scanned" |
| 4 | Submit "TEST QR – please ignore" | You land on the issue page and its location reads "TEST QR". On the admin map it is counted at "Blocks 3 and 4 area" |
| 5 | Admin: delete the "TEST QR" location. Scan the same code again | "QR location not recognised"; the location field is empty and nothing is pre-filled |
| 6 | Unknown id: on the phone, open `…/viewer/report?location=nothing-here` and `…/dashboard/report?location=nothing-here` | Both show a not-recognised notice and an empty location |
| 7 | Camera permission: deny the camera permission once in the phone's camera app, then scan | The phone's own app handles this; the web app asks for no camera access and must not prompt for it |

**Clean up:** delete the "TEST QR" location (step 5). The app has no screen for deleting an issue, so either leave the clearly labelled TEST issue (it is harmless and visible only as a sample-looking report) or have the project owner delete that one document in the Firebase console. Do not touch any other record.

**Do not** record a GPS position for a QR code; the code carries an id only.

## C. Vercel: new production project and the legacy project

**Status (2026-10-10): the app is deployed to the new project; the legacy project is NOT retired.**

| Project | Role | Address | State |
| --- | --- | --- | --- |
| `smart-campus-unifix` | **Production (new). Never disconnect, pause or delete this one.** | <https://smart-campus-unifix.vercel.app> | Latest production deployment `READY` on commit `4de4e74` (`origin/main`) |
| `smart-campus-issue-reporting-and-management-system` | Legacy, to be retired | `smart-campus-issue-reporting-and-ma.vercel.app` | Still serving the app. It has not been paused, disconnected or deleted |

What was verified on 2026-10-10:

- The new project failed to build earlier only because `NEXT_PUBLIC_FIREBASE_API_KEY` was missing from its environment. That variable was added (production and preview) and the commit redeployed. Nothing was changed in the legacy project.
- Against the new address the browser suite gave 121 passed, 8 skipped (the emulator-only spec): landing, Explore, `/viewer/worker`, login and registration pages, QR validation, map, mobile layouts and signed-out redirects.
- The Firebase settings compiled into the new bundle are identical to the legacy bundle's, so both talk to the same Firebase project.
- Signed-out Firestore reads are still denied.

**Not verified:** sign-in and signed-in workflows on the new address (no test account was used). Firebase Authentication's "Authorized domains" list has not been checked for the new hostname.

### Retiring the legacy project (you, in the Vercel dashboard)

Before you do it:

1. Sign in once as a test student at <https://smart-campus-unifix.vercel.app/login> and load the dashboard.
2. Firebase console → Authentication → Settings → **Authorized domains**: add `smart-campus-unifix.vercel.app` (harmless, and needed if email-link or OAuth sign-in is ever added).
3. Add `https://smart-campus-unifix.vercel.app/*` to the browser key's allowed websites (section D) **before** removing the legacy address from that list.

Then, in the **legacy** project only (`smart-campus-issue-reporting-and-management-system`):

4. **Settings → Domains**: confirm only its own `*.vercel.app` addresses are listed.
5. Pause it (reversible), or **Settings → Advanced → Delete Project**. Deleting is what removes the old hostname for good.
6. Push any commit and confirm that only the `smart-campus-unifix` check appears.

Do not change anything in `smart-campus-unifix`.

## D. Firebase browser key

**Status: pending. Not changed.** Evidence gathered on 2026-10-10 (no key value is recorded here):

| Question | Finding |
| --- | --- |
| Is a real private credential in the repository, history or build output? | No. No private key, service-account file, `.env` file (only `.env.local.example`), `sk_`/`ghp_`/`xox` token or `AIza` key other than placeholders (`AIzaSyDemo…REPLACE_WITH_YOUR_KEY`, `AIzaSyXXXX…`) in any commit on any branch, nor in `.next` output |
| Is any old browser key still referenced? | No. The one key the live site serves (prefix `AIzaSyB1…`) does not appear in the repository or its history; the site reads it from the Vercel environment |
| Is the active key restricted by website? | **No.** An Identity Toolkit request with an unrelated `Referer` (`https://example.invalid/`) and one with none were both accepted (`INVALID_ID_TOKEN`, i.e. the key itself was valid). An allowed-referrer request gave the same answer |
| Is it restricted by API? | Not established. The one unrelated API tried (Maps Geocoding) answered "not activated on your API project", which says the API is not enabled, not that the key is blocked from it |
| What does the key allow? | Sign-in and sign-up on the project's Auth, and Firestore requests subject to the Security Rules. Signed-out reads and writes were denied (403) on 2026-10-09 and 2026-10-10 |

A Firebase browser key is a public identifier by design, and every request is authorised by Firebase Authentication and the Security Rules (181 rules tests). The residual risk is quota abuse and account-creation spam through an unrestricted key, not data exposure.

Apply in Google Cloud console → project **campus-issue-rep-man-system** → **APIs & Services → Credentials** → the key the site uses (the one beginning `AIzaSyB1`):

1. **Application restrictions → Websites:**
   - `https://smart-campus-unifix.vercel.app/*`
   - `https://smart-campus-issue-reporting-and-ma.vercel.app/*` (legacy; keep until that project is retired)
   - `https://campus-issue-rep-man-system.firebaseapp.com/*` (also the value of `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, which is what the live bundle uses)
   - `http://localhost:3000/*` only if you still develop against the real project
2. **API restrictions → Restrict key**, then allow: Identity Toolkit API, Token Service API, Cloud Firestore API. Add Firebase Installations API only if the key's usage graph shows it.
3. Save, wait a few minutes, then on the live site: sign in, load a dashboard, submit nothing. If sign-in fails, re-check the referrer list first.
4. Repeat the probe below; both calls should now say "Requests from referer … are blocked" for the foreign referrer and succeed for the site.

```bash
KEY=<the key>   # do not paste it into a ticket or chat
curl -s -X POST -H "Referer: https://example.invalid/" -H "Content-Type: application/json" \
  -d '{"idToken":"invalid"}' "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=$KEY"
```

Do not rotate the key as part of this. Rotating it needs a new Vercel environment value and a redeploy, and does not reduce risk beyond what the restrictions do.

## E. Emulator run (automated signed-in checks)

These are the repeatable signed-in checks. They use only seeded `*@unifix.test` accounts on local emulators and refuse any non-local address.

```bash
# terminal 1 (Java 21+ on PATH)
npx firebase-tools emulators:start --only auth,firestore --project demo-unifix
# terminal 2
npm run seed:emulator -- --issues=60 --reset
# create .env.development.local with NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true, project id demo-unifix and placeholder values
npx next dev -p 3230
# terminal 3
E2E_EMULATOR=1 E2E_BASE_URL=http://localhost:3230 npx playwright test e2e/signed-in.emulator.spec.ts --workers=1
```

Delete `.env.development.local` afterwards. The spec covers: student report at a campus place, protected routes, discussion privacy, admin assign and escalate with persistence, worker start and resolve with a claim, one-time payment, worker kept out of finance, notification to the student, QR acceptance and refusals, submission failure and retry, and Explore while signed in.
