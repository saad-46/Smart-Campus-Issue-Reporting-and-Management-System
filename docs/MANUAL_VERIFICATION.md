# Manual verification checklist

What automation could not verify, and how a person can. Everything else is covered by the automated suites listed in `SMART_CAMPUS_FINAL_AUDIT.md`.

**Do not use, approve, reject, pay, edit or delete the existing pending expense claim (₹1,046) for any of this.** Use only records you create during the test.

## A. Signed-in production smoke test

**Environment:** <https://smart-campus-issue-reporting-and-ma.vercel.app/>, a desktop browser.

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

**Needs:** the admin account, a phone with a camera, the student account signed in on the phone (or sign in when asked).

1. Admin: **Locations & QR → Add location** (name "TEST QR", map place "Blocks 3 and 4 area"). Open its QR code.
2. Phone: scan the code from the screen with the camera app.
3. Expected: the report form opens with "TEST QR" shown as "From the QR code you scanned" (after sign-in if needed).
4. Submit a test report. On the issue page the location must read "TEST QR"; on the admin map it must be counted at "Blocks 3 and 4 area".
5. Admin: delete the "TEST QR" location. Scan the same code again. Expected: "QR location not recognised", with the location field empty.
6. Explore: open `/viewer/locations` on a desktop, open any location's QR code and scan it with the phone. Expected: the **demo** report form opens with that place selected, with no sign-in.

## C. Disconnect the duplicate Vercel project

The Vercel project **`smart-campus-unifix`** is connected to the same GitHub repository as the production project **`smart-campus-issue-reporting-and-management-system`**. Its build fails on every push and shows a red check on each commit. It cannot be changed from this repository; it needs the Vercel dashboard.

1. Vercel dashboard → project **smart-campus-unifix** → **Settings → Domains**. Confirm it has no domain you use. The production address `smart-campus-issue-reporting-and-ma.vercel.app` belongs to the other project.
2. **Settings → Git**. Confirm the connected repository is `saad-46/Smart-Campus-Issue-Reporting-and-Management-System`.
3. Click **Disconnect** (this stops the failing checks and deletes nothing). Optionally delete the project afterwards under **Settings → General**.
4. Do **not** change anything in `smart-campus-issue-reporting-and-management-system`.
5. Push any commit and confirm only one Vercel check appears.

## D. Restrict the Firebase browser key

Findings (2026-10-09): every key-shaped value in the Git history is a placeholder (`AIzaSyDemo…REPLACE_WITH_YOUR_KEY`, `AIzaSyXXXX…`), and Google rejects it as "API key not valid". No real key, service-account file, private key or `.env` file has ever been committed. There is therefore **no old key to disable**. What remains is good hygiene for the live key.

In Google Cloud console → project **campus-issue-rep-man-system** → **APIs & Services → Credentials** → the browser key used by the site:

1. **Application restrictions → Websites**, allow only:
   - `https://smart-campus-issue-reporting-and-ma.vercel.app/*`
   - `https://campus-issue-rep-man-system.firebaseapp.com/*` (the default Firebase auth domain; check the value of `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` in Vercel)
   - `http://localhost:3000/*` (local development; remove if not needed)
2. **API restrictions → Restrict key**, allow only:
   - Identity Toolkit API
   - Token Service API
   - Cloud Firestore API
   - Firebase Installations API, if the key's usage graph shows it in use
3. Save, wait a few minutes, then sign in on the live site and load a dashboard to confirm nothing broke. If sign-in fails, re-check the referrer list before anything else.
4. If the credentials page lists any other browser key that nothing uses, delete it there. Do not delete a key without first checking its usage graph on that page.

A Firebase browser key identifies the project; it is not a password. Access to data is decided by Firebase Authentication and the Firestore Security Rules, which the 181 rules tests cover.
