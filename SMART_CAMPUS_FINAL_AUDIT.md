# Smart Campus Management System (UniFix)
## Final Code Audit & Security Report

Audit date: 3 October 2026 · Audited commit: `d08cc12` (branch `main`) plus two uncommitted local edits that were already in the working tree.

Everything below comes from reading the code and from commands and tests actually run during the audit. Where something was not tested, it says so.

> **Update — Final Hardening Pass (§15).** A second pass resolved the open High finding (worker self-registration) and most open Medium findings, and found and fixed five new issues, one of them a regression from this audit's own first pass. Current status, counts and the deployment checklist are in **§15**; sections 1–14 are kept as the original record. Status: **READY FOR HUMAN VERIFICATION BEFORE DEPLOYMENT**. The Firestore rules are **not deployed**.

---

## 1. Executive Summary

**Before the audit the application was not safe to deploy and could not be built.**

- The production build failed (`npm run build` and `npx tsc --noEmit` both errored).
- The Firestore rules allowed any signed-in user to read, change or delete every document in the database.
- Every account was created holding the roles `user`, `worker` **and `admin`**, registration offered "Administrator" as a choice, and a "Switch Role" page let anyone enter the admin dashboard.
- The admin dashboard injected an issue's *location* text into the page as HTML, so any user could run script in an administrator's browser.

**After the audit**

- Build, type check, lint, 119 unit tests and 87 security-rule tests all pass.
- The rules were rewritten as a deny-by-default permission model. The same 87 rule tests were also run against the *original* rules: 71 of them fail there, which is a direct measurement of what was exposed.
- Admin access is now an allow-list (`admins/{uid}`) that no client can write.
- The student, worker and admin journeys were exercised end-to-end in a browser against local Firebase emulators.

**What you still need to do — the app is not production-ready until these are done**

1. **The new rules are not deployed.** Nothing was changed in your live Firebase project. Until you deploy `firestore.rules`, production is still wide open.
2. **Create `admins/{uid}` for your real administrators before deploying the rules** (steps in §7). Otherwise nobody can open the admin dashboard.
3. **Decide whether workers may self-register.** Today anyone can register as a worker (see finding H-10). This is the one significant authorization question left open, because closing it needs a product decision and an approval screen that does not exist yet.

**Verdict:** the code is in a deployable state and the critical vulnerabilities are fixed and verified locally, but I would not call the *system* production-ready until items 1–3 are done and the "must fix" list in §12 is cleared.

---

## 2. Technology Stack (as detected)

| Layer | Detected |
|---|---|
| Runtime | Node v24.19.0, npm 11.17.0 |
| Framework | Next.js 15.5.27 (App Router; was 15.5.15), React 19.2.5 |
| Language | TypeScript 5.9.3, `strict: true` |
| Styling | Tailwind CSS 4.2.2 via `@tailwindcss/postcss` |
| Auth | Firebase Authentication 11.10.0, email/password only |
| Database | Cloud Firestore (web SDK, browser-only; no server code, no Admin SDK) |
| Charts | Recharts 3.8.1 |
| "AI" | Keyword matching in the browser. **No LLM, no external API.** |
| Storage | None. Images are base64 strings stored inside Firestore documents. |
| Added by audit | ESLint 9 + `eslint-config-next`, Vitest 5, `@firebase/rules-unit-testing` |

The README describes roles as "User & Admin" and the product as "CampusIQ"; the code has three roles (user, worker, admin) and the UI is branded "UniFix". The README was corrected where it was wrong about roles, rules and AI.

---

## 3. Architecture

```text
Browser (all pages are client components)
  app/*                  pages: / /login /register /dashboard /dashboard/report
                                /issues/[id] /worker /admin /switch-role
  components/*           guards (ProtectedRoute, AdminGuard, WorkerGuard), forms, cards
  hooks/useAuth          auth state + profile + admin grant + active role
        │
  lib/firestore.ts  lib/finance.ts  lib/auth.ts  services/chatService.ts   ← only place Firestore is called
  lib/validation.ts lib/models.ts lib/dates.ts lib/errors.ts lib/roles.ts lib/constants.ts
        │
  Firebase Auth  +  Cloud Firestore  ←  firestore.rules (the real authorization layer)
```

- **Authentication:** Firebase email/password. `hooks/useAuth.ts` listens to auth state, then loads `users/{uid}` and checks for `admins/{uid}`.
- **Authorization:** decided in `firestore.rules`. The React guards only decide what to *show*.
- **Database collections:** `users`, `admins` (new), `issues`, `issues/{id}/messages`, `finance/budget`, `transactions`.
- **Issue lifecycle:** `Open → In Progress → Resolved`, one step at a time, forward only.
- **AI:** `services/aiService.ts` scores keywords per category and picks a priority from urgency words. Its output is treated as an untrusted suggestion: `createIssue()` and the rules both re-validate category and priority.
- **Real-time:** Firestore `onSnapshot` listeners, each returning an unsubscribe function that the owning `useEffect` cleans up.

---

## 4. Findings

Severity follows the brief: P0 Critical, P1 High, P2 Medium, P3 Low.

| ID | Sev | Area | Finding | Risk | Status |
|---|---|---|---|---|---|
| C-1 | P0 | Firestore rules | `allow read, write: if request.auth != null` on every document | Any signed-in user could read all profiles and emails, edit or delete any issue, rewrite the budget, credit themselves earnings | **Fixed** |
| C-2 | P0 | Roles | Every profile created with `roles: ["user","worker","admin"]`; registration offered Admin; `/switch-role` and the top-bar selector let anyone become admin; role lived in a document its owner could edit | Full privilege escalation by any visitor | **Fixed** |
| C-3 | P0 | XSS | Admin "Auto Insights" used `dangerouslySetInnerHTML` with an issue's `location` | Stored XSS: a student runs script in an admin's session | **Fixed** |
| H-1 | P1 | Build | `next build` and `tsc` failed (Recharts formatter type; dead `storageService.ts` importing a non-existent export) | App could not be built for production | **Fixed** |
| H-2 | P1 | Lifecycle | No transition rules anywhere; any user could set any status, including resolving their own issue or reopening a resolved one | False resolutions, corrupted workflow | **Fixed** |
| H-3 | P1 | Payments | `executePayment` trusted the amount and payee held in browser state, never checked the claim was still pending, never checked the budget | Double payment by double-click or two admins; overspending; paying a stale amount | **Fixed** |
| H-4 | P1 | Payments | Admin's pending list required a receipt photo, but the photo is optional | Claims submitted without a photo were invisible and never paid | **Fixed** |
| H-5 | P1 | Data | Images stored as raw base64, up to 5 MB each, 3 per issue; receipts had no type or size check. Firestore documents are capped at 1 MiB | Submissions with ordinary phone photos fail | **Fixed** |
| H-6 | P1 | UX | Manual form on the dashboard stayed on "Submitting…" forever after a *successful* save (it navigated to the page it was already on) | Users resubmit and create duplicates | **Fixed** |
| H-7 | P1 | Injection | Image and receipt URLs were unvalidated and rendered into `<img src>` and `<a href>` | `javascript:` link an admin clicks; tracking pixels | **Fixed** |
| H-8 | P1 | Privacy | Issue chat was "private" only in the UI; anyone could read or post, and set any author name or role badge | Impersonating staff; reading private threads | **Fixed** |
| H-9 | P1 | Dependencies | Next.js 15.5.15 carried advisories rated critical by `npm audit` | See §11 | **Fixed** (15.5.27) |
| H-10 | P1 | Roles | Anyone can self-register as a **worker** | A fake worker can claim tasks, mark them resolved and file expense claims (claims still need admin approval to be paid) | **Open — needs your decision** |
| M-1 | P2 | Validation | Firestore documents were cast to TypeScript types with no runtime checks | Missing or malformed fields crash pages or render `Invalid Date` | **Fixed** |
| M-2 | P2 | Validation | No length limits or trimming on any input; whitespace-only values accepted | Oversized or empty reports | **Fixed** |
| M-3 | P2 | Errors | Most failures only went to `console.error`; some raw Firebase messages were shown to users | Silent failures; leaked internals | **Fixed** |
| M-4 | P2 | Listeners / cost | User dashboard listened to *all* issues at all times and re-subscribed on every tab change; worker page listened to all issues; no listener had an error handler | Unnecessary reads; permanent spinner on error | **Fixed** |
| M-5 | P2 | Auth | Sign-up raced the auth listener; a slow profile load could overwrite a newer user's state; an account whose profile write failed was unusable forever; routing trusted `localStorage["role"]` | Wrong redirects, stuck accounts | **Fixed** |
| M-6 | P2 | AI | Substring matching ("ac" inside "back", "rat" inside "separate"); one-sentence chat reports saved with an empty description; an analysis error blocked submission | Wrong categories; empty reports | **Fixed** |
| M-7 | P2 | Duplicates | Chat could be sent twice with Enter; Reject, Claim, Start had no in-flight guard; upvote count went stale | Duplicate writes | **Fixed** |
| M-8 | P2 | Analytics | Resolution chart dropped every issue resolved in 3–6 h; one "insight" always claimed a "20% improvement" that was never computed; KPI colours built from dynamic class names Tailwind never generates | Misleading numbers shown to admins | **Fixed** |
| M-9 | P2 | Tooling | `npm run lint` opened an interactive prompt (ESLint never configured); zero tests | No automated safety net | **Fixed** |
| M-10 | P2 | Accessibility | Labels not linked to inputs; clickable `<div>`/`<img>`/`<tr>`; dialogs without roles or Escape; unnamed icon buttons | Unusable by keyboard or screen reader | **Fixed** (see §10) |
| M-11 | P2 | Bug | Image-editor buttons had no `type`, so inside the issue form "Undo", "Cancel" and "Save Edits" also submitted the form | Editing a photo jumped to the review step | **Fixed** |
| M-12 | P2 | Headers | No security headers; `X-Powered-By` exposed; Firebase Auth pulled a script from `apis.google.com` it did not need | Clickjacking, weaker XSS containment | **Fixed** |
| M-13 | P2 | Docs | Four setup documents told readers to paste permissive rules; README misdescribed roles and AI | Next person re-opens the database | **Fixed** |
| M-14 | P2 | Routing | `useSearchParams` without a Suspense boundary; `?tab=` value used without validation | Build bail-out; broken view | **Fixed** |
| M-15 | P2 | Offline | If Firestore is unreachable a save waits indefinitely | Spinner with no explanation | **Partly fixed** — never reports false success; explains after 10 s. Queued write is not cancelled. |
| M-16 | P2 | Cost | Images live inside issue documents, so every list listener downloads every image | Read cost and bandwidth grow with usage | **Partly fixed** — images now ≤ ~165 KB each, listeners scoped. Architecture unchanged. |
| M-17 | P2 | Performance | Admin dashboard subscribes to the entire `issues` collection with no pagination | Slows as data grows | **Open** |
| M-18 | P2 | Dependencies | `@grpc/grpc-js` (via `firebase`) and `postcss` (via `next`) advisories remain | See §11 | **Open** — fixes need major-version upgrades |
| M-19 | P2 | Headers | CSP still needs `'unsafe-inline'` for scripts | Weaker than a nonce-based policy | **Open** — documented in `next.config.ts` |
| M-20 | P2 | Abuse | No rate limiting or App Check | Issue spam; five accounts can force any issue to High priority | **Open** |
| M-21 | P2 | Auth | No email verification | Throwaway accounts | **Open** |
| L-1 | P3 | Logging | `console.log` of emails, names, UIDs, issue text | Data in shared-device consoles | **Fixed** |
| L-2 | P3 | Git | `.gitignore` covered `.env*.local` only | A `.env` or service-account JSON could be committed | **Fixed** |
| L-3 | P3 | Polish | No viewport/Open Graph metadata, icon, 404 or error page | Blank screen on render errors | **Fixed** |
| L-4 | P3 | Responsive | Issue page header sat under the mobile menu button; fixed 100dvh layout on small screens | Overlap on phones | **Fixed** |
| L-5 | P3 | Dead code | `storageService.ts` (broken) and an unused `liveActivity` computation removed. `escalationService`, `predictionService`, `analyticsService`, `ui/Modal`, `ui/Toast`, `ui/Select` are still unused | Maintenance noise | **Partly fixed** |
| L-6 | P3 | Config | `.env.local` defines `NEXT_PUBLIC_ADMIN_EMAILS`; no code reads it | False sense that it controls admin access | **Documented** (your file was not edited) |
| L-7 | P3 | Git history | Two old commits contain a Firebase web-API-key-shaped value for a `campus-iq-demo` project | Low; web keys are identifiers, not secrets | **Documented** |
| L-8 | P3 | Styling | `tailwind.config.ts` is ignored by Tailwind v4, so `animate-fade-in` / `animate-slide-up` do nothing | Cosmetic | **Open** |
| L-9 | P3 | Content | Landing page shows hard-coded figures ("500+ issues resolved", "98% satisfaction") | Not real data | **Open** |

**Totals**

| Severity | Found | Fixed | Partly fixed | Open / documented |
|---|---:|---:|---:|---:|
| Critical (P0) | 3 | 3 | 0 | 0 |
| High (P1) | 10 | 9 | 0 | 1 |
| Medium (P2) | 21 | 14 | 2 | 5 |
| Low (P3) | 9 | 4 | 1 | 4 |

---

## 5. Security Findings

**Authentication.** Email/password via Firebase. Password policy raised from 6 characters to 8 with a letter and a number (client-side; set the same policy in Firebase Console → Authentication → Settings to enforce it server-side). Login errors no longer distinguish "no such user" from "wrong password". Session persistence, refresh while signed in/out, and sign-out were tested in the browser.

**Authorization.** Previously enforced only by React guards reading a role the user could edit. Now enforced by rules; the guards mirror them for UX. Direct navigation to `/admin` and `/worker` as a normal user redirects to `/dashboard`, and — more importantly — the underlying reads are denied.

**Firestore.** See §7. Verified by 87 emulator tests and by nine direct REST calls made with a real student token, bypassing the UI entirely:

```text
set own role=admin            PERMISSION_DENIED
set own activeRole=admin      PERMISSION_DENIED
create admins/{self}          PERMISSION_DENIED
read finance/budget           PERMISSION_DENIED
list all users                PERMISSION_DENIED
mark own issue Resolved       PERMISSION_DENIED
set own earnings              PERMISSION_DENIED
unauthenticated read issues   PERMISSION_DENIED
read own issue                OK
```

**XSS.** One exploitable sink (C-3) removed. The only remaining `dangerouslySetInnerHTML` is a static theme script in `app/layout.tsx` with no user data. No `eval`, `Function()`, `innerHTML` or `document.write` anywhere. Payloads `<script>alert('XSS')</script>`, `<img src=x onerror=alert('XSS')>` and `<b onmouseover=alert(1)>` were submitted as title, description, location and chat text and rendered as inert text on the dashboard, issue page, worker page and admin dashboard (checked in the DOM: zero injected elements).

**Injection.** There is no SQL and no server. Image/receipt URLs are now restricted to inline `data:image/(jpeg|png|webp)` in the rules and re-checked before rendering.

**Secrets.** No service-account key, private key or `.env` file has ever been committed (checked every commit on every branch). The live web API key in `.env.local` appears nowhere in history. See L-7 for the one demo-project value. Firebase web API keys are not secrets, but restrict yours to your domains in Google Cloud Console.

**Role escalation.** Tested for `role`, `roles`, `activeRole`, `isAdmin`, `earnings`, and the `admins` collection: all rejected. A legacy profile that already says `role: "admin"` gains nothing without an `admins/{uid}` document.

**Data access.** Profiles are private to their owner and admins. **Issues are readable by every signed-in user by design** — the "Explore" feed and the worker task pool depend on it. If reports should be private, that is a product change.

---

## 6. Bugs Fixed

**C-1 / C-2 — open database and self-service admin**
- *Root cause:* hackathon rules plus a role model stored in a user-writable document.
- *Fix:* new `firestore.rules`; admin = document in `admins/{uid}` (client-unwritable); worker = `users/{uid}.role`, immutable to its owner; registration limited to user/worker; role switcher only offers granted roles.
- *Files:* `firestore.rules`, `lib/roles.ts`, `lib/auth.ts`, `hooks/useAuth.ts`, guards, `app/register`, `app/switch-role`, `components/TopNav.tsx`.
- *Verified:* the "role escalation" group of rule tests, the REST attack above, and the browser.

**C-3 — stored XSS in admin insights**
- *Root cause:* string → HTML via `dangerouslySetInnerHTML`.
- *Fix:* `renderInsight()` builds React elements. *File:* `app/admin/page.tsx`.
- *Verified:* location `<b onmouseover=alert(1)>Block A</b>` appears as literal text in the insight; no `<b>` element created.

**H-1 — build failure**
- *Fix:* corrected the Recharts formatter signature; deleted `services/storageService.ts` (imported a `storage` export that was removed with Firebase Storage; nothing used it).
- *Verified:* `npm run build` and `npx tsc --noEmit` exit 0.

**H-2 — lifecycle**
- *Fix:* `canTransition()` in `lib/constants.ts`; status changes run in transactions (`lib/firestore.ts`); rules allow only the assignee (or an admin) to move forward one step, with server timestamps.
- *Verified:* the "issue lifecycle" group of rule tests; browser flow Open → In Progress → Resolved.

**H-3 / H-4 — payments**
- *Fix:* `approveClaim()` reads the issue, budget and worker inside one transaction, requires `claimStatus == "pending"`, takes the amount from the document, and refuses if the budget is short. Rules additionally cap `totalSpent ≤ totalAvailable` and make the ledger append-only. Pending list now keys on claim status.
- *Files:* `lib/finance.ts`, `app/admin/page.tsx`, `firestore.rules`.
- *Verified:* double-clicked "Send Payment" → exactly 1 transaction, spent ₹450, worker earnings ₹450, claim `approved` (read back from the emulator).

**H-5 — oversized images**
- *Fix:* `lib/image.ts` re-encodes to JPEG and steps down size/quality until the data URL fits (220 000 characters per issue image, 250 000 for a receipt); max 3 images enforced when adding, not silently at submit.
- *Verified:* type check and rules size tests only. **The compression path was not exercised in a browser** (the test browser cannot pick files).

**H-6 — form stuck after success**
- *Fix:* `IssueForm` takes an `onIssueCreated` callback; the dashboard switches to "My Issues". *Verified in browser.*

**H-7 / H-8** — covered by rules (`validImage`, `messages` block) plus `isDisplayableImageUrl()` and a chat subscription that only starts when the viewer is entitled. *Verified:* rule tests and browser.

**M-5 — auth races and orphaned accounts**
- *Fix:* generation counter discards stale profile loads; a `signingUp` flag stops the listener racing registration; `createMissingProfile()` repairs an account that has no profile; `localStorage["role"]` removed.
- *Verified:* an Auth-only account (no profile) logged in through the UI and got a working profile. This test also caught a bug in my own first version (it discarded the admin grant for such accounts), which was fixed and re-tested.

**M-6 — AI classifier**
- *Fix:* whole-word matching for short keywords, stem matching for longer ones; title + description analysed; full message kept as description; failure falls back to General/Low and still lets the user submit.
- *Verified:* 30 tests in `tests/unit/aiService.test.ts`.

Other fixes are listed per file in §13.

---

## 7. Firestore Security

### Permission model

| Action | Anonymous | User — own | User — other's | Worker | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Read an issue | ✗ | ✓ | ✓ | ✓ | ✓ |
| Create an issue (as self, status Open, no votes, server time) | ✗ | ✓ | — | ✓ | ✓ |
| Edit issue text / author / created time / images | ✗ | ✗ | ✗ | ✗ | ✗ |
| Upvote / remove own upvote | ✗ | ✓ | ✓ | ✓ | ✓ |
| Claim an open unassigned issue | ✗ | ✗ | ✗ | ✓ (self only) | ✓ |
| Open → In Progress → Resolved | ✗ | ✗ | ✗ | ✓ (assignee only) | ✓ (forward only) |
| Submit expense claim (pending only) | ✗ | ✗ | ✗ | ✓ (assignee, on resolve) | — |
| Approve / reject a pending claim | ✗ | ✗ | ✗ | ✗ | ✓ (once) |
| Delete an issue | ✗ | ✓ only while Open and unassigned | ✗ | ✗ | ✓ |
| Read a profile | ✗ | ✓ | ✗ | own only | ✓ |
| Create own profile (role user or worker) | ✗ | ✓ | ✗ | — | — |
| Change `role` / `roles` / `earnings` | ✗ | ✗ | ✗ | ✗ | ✓ |
| Switch `activeRole` | ✗ | ✓ within granted roles | ✗ | ✓ within granted roles | ✓ |
| Write `admins/*` | ✗ | ✗ | ✗ | ✗ | ✗ (console only) |
| Read / post in an issue's chat | ✗ | ✓ | ✗ | ✓ | ✓ |
| Edit / delete a chat message | ✗ | ✗ | ✗ | ✗ | ✗ |
| Read budget | ✗ | ✗ | ✗ | ✗ | ✓ |
| Change budget (spent ≤ available) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Read transactions | ✗ | ✗ | ✗ | own only | ✓ |
| Create a transaction | ✗ | ✗ | ✗ | ✗ | ✓ |
| Edit / delete a transaction | ✗ | ✗ | ✗ | ✗ | ✗ |
| Any other collection | ✗ | ✗ | ✗ | ✗ | ✗ |

Every cell is covered by at least one test in `tests/rules/firestore.rules.test.ts`.

### Deploying (not done by this audit)

1. In Firebase Console → Authentication, copy the UID of each real administrator.
2. In Firestore, create a document `admins/{UID}` for each (any content).
3. Deploy the app and the rules together:
   `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`
4. Existing accounts that registered as "admin" become ordinary users unless they have an `admins/` document. Accounts that should be workers need `role: "worker"` set by an admin (console, or any admin tooling you add).

### Custom claims

Firebase custom claims would be a cleaner admin signal (no extra document read per request) but need server code — the Admin SDK in a Cloud Function or script — which this project does not have. The `admins/` allow-list gives the same guarantee without new infrastructure.

---

## 8. Testing Results

| Check | Before | After |
|---|---|---|
| `npm run lint` | Not runnable (interactive setup prompt) | **PASS** — 0 errors, 0 warnings |
| `npx tsc --noEmit` | **FAIL** — 2 errors | **PASS** |
| `npm run build` | **FAIL** — type error | **PASS** — 12 pages generated |
| Unit tests (`npm test`) | none existed | **PASS** — 119 / 119 in 3 files |
| Security-rule tests (`npm run test:rules`) | none existed | **PASS** — 87 / 87 |
| Same rule tests against the original rules | — | 71 fail, 16 pass (expected: shows what was open) |
| `npm audit` | 8 (2 critical, 5 high, 1 moderate) | 7 (0 critical, 6 high, 1 moderate) — see §11 |

**End-to-end, in a browser, against local Auth + Firestore emulators** (no contact with the real project):

| Journey | Result |
|---|---|
| Student: register → dashboard → report (manual form) → appears once in My Issues → open thread → chat → sign out | PASS |
| Student: report via AI chat → confirmation step | PASS |
| Empty form, weak password, wrong password | PASS — clear messages, no network call for invalid input |
| Double-click Submit Issue / Send Payment / Upvote | PASS — one write each |
| Normal user → `/admin`, `/worker` | PASS — redirected; role switcher shows only "User" |
| Logged out → every protected route | PASS — redirected to `/login` |
| Worker: register → claim → start → resolve with ₹450 claim, no photo | PASS |
| Admin: bootstrap via `admins/{uid}` → switch to Admin → review claim → pay → add funds | PASS |
| Student sees the issue as Resolved afterwards | PASS |
| Backend stopped mid-submit | PASS — no false success; "still trying" notice after 10 s |
| Production build served locally | PASS — strict CSP in place, no console errors, no third-party requests |

**Responsive** (horizontal-overflow check via the DOM): `/`, `/login`, `/register` at 320; `/` at 768; `/admin` at 320, 375, 768, 1366; `/dashboard` (Explore) and `/issues/[id]` at 320 — all PASS. **Not checked:** 390×844, 1024×768, 1920×1080 individually, and `/worker` below desktop width.

**Not tested**
- Anything against your live Firebase project (deliberately).
- Image upload and compression in a real browser.
- Real phones or tablets; screen readers; measured colour contrast.
- Two people acting on the same record at the same moment (covered by transaction logic and rule tests, not by a live concurrent test).
- Signed-in traffic under the production CSP (the policy allows `*.googleapis.com`, which covers Auth and Firestore, but only the signed-out pages were loaded from the production build).

---

## 9. Performance

- **Fewer reads for students:** the dashboard now keeps one listener on the user's own issues and opens the community feed only while the Explore tab is visible, capped at the 100 newest. Previously both ran permanently and were torn down and recreated on every tab click.
- **Fewer reads for workers:** two scoped queries (my tasks; open unassigned pool) instead of the whole collection.
- **Smaller documents:** images are compressed before saving, and the first image is no longer stored twice (`imageUrl` duplicated `imageUrls[0]`).
- **No repeated "AI" calls:** the worker card's suggestion effect depended on the issue object, which is new on every snapshot; it now depends on the text fields.
- **Not addressed:** the admin dashboard still loads every issue (M-17), and images still travel with every list read (M-16).

---

## 10. Accessibility

Fixed:
- `Input`, `Textarea`, `Select` now link label and control (`htmlFor`/`id`) and expose errors via `aria-describedby`. Verified: clicking the "Expense Amount" label focuses the field.
- Clickable images and table rows became real buttons or gained `role`, `tabIndex` and Enter/Space handling.
- Dialogs have `role="dialog"`, `aria-modal`, a label, and close on Escape (verified for Add Funds).
- Icon-only buttons have names; toggles expose `aria-pressed`; menus expose `aria-expanded`.
- Errors use `role="alert"`, loading states `role="status"`, chat logs `aria-live`.
- Hidden file inputs are focusable instead of `display:none`.

Not done: focus trapping inside dialogs, a contrast audit, and screen-reader testing.

---

## 11. Dependency Audit

| Package | Severity | How it gets here | Exploitable in this app? | Action |
|---|---|---|---|---|
| `next` 15.5.15 | critical (per npm) | direct | The advisories concern middleware, Server Actions, the image optimiser and RSC caching. This app uses none of them, but the fix was free. | **Upgraded to 15.5.27** (same major) |
| `websocket-driver`, `protobufjs`, `nanoid`, `sharp` | critical / high | transitive | Mostly build-time or Node-only | **Resolved** by `npm audit fix` (no breaking changes) |
| `@grpc/grpc-js` ≤ 1.13.5 | high | `firebase` → `@firebase/firestore` | Used only by Firestore's Node build. This app talks to Firestore from the browser, which does not use gRPC. | **Open.** npm's only offered "fix" is a downgrade to firebase 9. Revisit when Firebase ships a patched dependency. |
| `postcss` ≤ 8.5.22 | high | bundled inside `next` | Build-time, processing only this repo's CSS | **Open.** Needs Next 16 (breaking). |

`npm audit fix --force` was **not** run: it would downgrade Firebase by two majors and jump Next a major.

---

## 12. Remaining Issues

**Must fix before production**
1. Deploy `firestore.rules` and create the `admins/` documents (§7). Until then the live database has the old rules.
2. Decide on worker self-registration (H-10). Recommended: registration always creates `user`; an admin promotes workers. This needs a small admin screen.
3. Set the password policy in the Firebase console so it is enforced server-side, and restrict the web API key to your domains.
4. Test image upload on a real phone (H-5 fix is unverified in a browser).

**Recommended**
- Firebase App Check and/or rate limiting against spam and upvote brigading (M-20).
- Email verification (M-21).
- Move images out of issue documents (a subcollection or Storage) and paginate the admin dashboard (M-16, M-17).
- Plan the Next 16 upgrade to clear the remaining advisories (M-18).
- Nonce-based CSP via middleware to drop `'unsafe-inline'` (M-19).
- Rotate nothing urgently — no private credential was found — but delete `NEXT_PUBLIC_ADMIN_EMAILS` from `.env.local`; it does nothing (L-6).

**Optional**
- Remove the unused services and UI components (L-5).
- Replace the hard-coded landing-page statistics (L-9).
- Port the keyframes from `tailwind.config.ts` into `globals.css` so the entrance animations work (L-8).
- Focus trapping in dialogs.

---

## 13. Changed Files

**New**

| File | Purpose |
|---|---|
| `lib/constants.ts` | Roles, statuses, categories, limits, lifecycle transitions — one source of truth |
| `lib/validation.ts` | Input validation and image-URL checks |
| `lib/models.ts` | Runtime normalisation of Firestore documents |
| `lib/dates.ts` | Safe date conversion and formatting |
| `lib/errors.ts` | User-safe error messages, safe logging, offline guard |
| `lib/roles.ts` | Granted-role and routing helpers |
| `lib/image.ts` | Client-side image validation and compression |
| `hooks/useSlowNotice.ts` | "Still trying to reach the server" notice |
| `components/ProfileUnavailable.tsx` | Retry screen when a profile cannot be loaded |
| `app/error.tsx`, `app/not-found.tsx`, `app/icon.svg` | Error boundary, 404 page, icon |
| `eslint.config.mjs`, `vitest.config.mts`, `vitest.rules.config.mts` | Lint and test configuration |
| `firebase.json`, `firestore.indexes.json` | Rules deployment and emulator configuration |
| `tests/unit/*.test.ts` (3 files) | 119 unit tests |
| `tests/rules/firestore.rules.test.ts` | 87 security-rule tests |
| `SMART_CAMPUS_FINAL_AUDIT.md` | This report |

**Modified**

| File | What and why |
|---|---|
| `firestore.rules` | Complete rewrite (C-1, C-2, H-2, H-3, H-7, H-8) |
| `lib/firebase.ts` | Config check; Auth without the popup resolver (no third-party script); optional emulator mode |
| `lib/auth.ts` | Validated sign-up, no admin self-assignment, profile repair, admin-grant lookup, logging removed |
| `lib/firestore.ts` | Validation, server timestamps, transactional status/claim/upvote, scoped queries, listener error handlers |
| `lib/finance.ts` | Transactional `approveClaim` with pending and budget checks; normalised reads |
| `hooks/useAuth.ts` | Race fixes, granted roles, `switchRole` that throws, no `localStorage` role |
| `services/aiService.ts` | Word-boundary matching, safe fallbacks, honest header comment |
| `services/chatService.ts` | Validation, server timestamp, error callback |
| `components/AuthProvider.tsx`, `ProtectedRoute.tsx`, `AdminGuard.tsx`, `WorkerGuard.tsx` | Use granted roles; show a retry screen instead of a blank page |
| `components/IssueForm.tsx` | Validation, image compression, AI fallback, success callback, slow-save notice |
| `components/ChatReporter.tsx` | Double-send guard, friendly errors, retry stays on confirm step |
| `components/BillSubmissionForm.tsx` | Amount validation, receipt type/size check and compression |
| `components/IssueCard.tsx`, `ImageModal.tsx`, `ImageEditor.tsx`, `ui/UpvoteButton.tsx` | Keyboard access, correct image in modal, button types, live vote counts |
| `components/ui/Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Toast.tsx` | Label association; unused import |
| `components/TopNav.tsx`, `Sidebar.tsx`, `ThemeProvider.tsx` | Role switcher limited to granted roles; guarded storage access |
| `app/page.tsx`, `login`, `register`, `switch-role`, `dashboard`, `dashboard/report`, `issues/[id]`, `worker`, `admin` | Fixes described in §4 and §6 |
| `app/layout.tsx` | Viewport and Open Graph metadata |
| `next.config.ts` | Security headers and CSP |
| `package.json`, `package-lock.json` | Lint/test scripts; Next 15.5.27; dev dependencies |
| `.gitignore`, `.env.local.example` | Ignore all env and credential files; explain admin access |
| `README.md`, `QUICK_FIREBASE_SETUP.md`, `FIREBASE_SETUP_CHECKLIST.md`, `FIRESTORE_RULES_FIX.md` | Insecure rule snippets replaced with a pointer to `firestore.rules` |

**Deleted:** `services/storageService.ts` (broken and unused).

**Behaviour changes you will notice**
- Registration no longer offers "Administrator".
- Passwords need 8+ characters with a letter and a number.
- The role switcher appears only for accounts with more than one role.
- At most 3 images per issue, enforced when adding.
- Resolution chart's third bucket is "> 3 hr" (was "> 6 hr", which dropped data).
- "AI Generated Diagnostics" is now labelled "Automated Diagnostics" and no longer shows an invented percentage.

---

## 14. Final Verification

Commands run after all changes, with results:

```text
npm install                         ok
npm run lint                        exit 0   (0 errors, 0 warnings)
npx tsc --noEmit                    exit 0
npm test                            119 passed (3 files)
npm run test:rules   (*)            87 passed (1 file)
npm run build                       exit 0   (Compiled successfully; 12/12 static pages)
npm audit                           7 vulnerabilities (1 moderate, 6 high), 0 critical
```

(*) Requires JDK 21+. This machine has Java 8, so a portable JDK was used from a temporary folder; nothing was installed system-wide. To run it yourself, install JDK 21 and run `npm run test:rules`.

### Regression checklist

| Feature | Status | Evidence |
|---|---|---|
| Authentication (login, session persistence) | PASS | Browser, emulator |
| Registration | PASS | Browser, emulator |
| Logout | PASS | Browser |
| User dashboard | PASS | Browser |
| Issue reporting — manual form | PASS | Browser |
| Issue reporting — AI chat | PASS | Browser to confirm step; successful save path shares `createIssue` with the form |
| Issue reporting — with images | NOT TESTABLE | No file picker in the test browser; type-checked and rule-tested only |
| Issue history | PASS | Browser |
| AI categorization | PASS | 30 unit tests + browser |
| AI priority | PASS | Unit tests + browser |
| Real-time updates | PASS | Status and upvote changes appeared without reload |
| Admin dashboard | PASS | Browser |
| Filtering (status, category) | PARTIAL | Logic unchanged apart from the category list; not clicked through in the browser |
| Status updates | PASS | Browser + rule tests |
| Role protection | PASS | Browser + rule tests + REST attack |
| Firestore access | PASS | 87 rule tests |
| Responsive UI | PARTIAL | See §8 for widths covered |
| Error states | PASS | Wrong password, validation, backend down |
| Loading states | PASS | Browser |
| Empty states | PASS | Browser (new account dashboards) |
| Accessibility | PARTIAL | Structural fixes verified in the DOM; no screen-reader or contrast testing |
| Live Firebase project | NOT TESTED | Deliberately untouched |

### Git

All changes are uncommitted in the working tree on `main`. Nothing was committed or pushed. No temporary files remain in the repository.

---

## 15. Final Hardening Pass

Second pass, same day. Sections 1–14 above are the first audit and are left as written; where a status below differs, **this section is current**. Nothing was committed, pushed or deployed, and the live Firebase project was not touched. Every browser test ran against local Auth and Firestore emulators.

### 15.1 Checklist taken from the first report

| ID | Was | Now | What was done |
|---|---|---|---|
| H-10 | Open | **Fixed** | Worker access is admin-approved (§15.2) |
| M-15 | Partly fixed | **Fixed** | Issue creation and chat messages use transactions, which fail instead of queueing offline (§15.4) |
| M-16 | Partly fixed | **Fixed** | Full photos moved out of issue documents (§15.5) |
| M-17 | Open | **Fixed** | Admin dashboard uses bounded queries plus server-side counts (§15.6) |
| M-18 | Open | **Fixed** (with caveat) | Two non-major overrides; `npm audit` reports 0 (§15.9) |
| M-19 | Open | **Open — deferred** | A nonce-based CSP needs dynamic rendering; explained in §15.10 |
| M-20 | Open | **Partly fixed** | Server-side rate limit on issue creation; full abuse protection needs App Check (§15.7) |
| M-21 | Open | **Partly fixed** | Verification email sent; not enforced — product decision (§15.8) |
| L-5 | Partly fixed | **Fixed** | Removed `escalationService`, `predictionService`, `analyticsService`, `ui/Modal`, `ui/Toast`, `ui/Select` (no imports anywhere; build passes) |
| L-6 | Documented | **Documented** | `NEXT_PUBLIC_ADMIN_EMAILS` is in your private `.env.local`; delete it (human action) |
| L-7 | Documented | **Documented** | Old commits hold a demo-project web key; fixing needs a history rewrite, which isn't justified for a non-secret |
| L-8 | Open | **Fixed** | Entrance animations defined in `globals.css` (Tailwind v4 ignores `tailwind.config.ts`); respects `prefers-reduced-motion` |
| L-9 | Open | **Open — product decision** | Landing-page statistics are hard-coded marketing copy. Showing real numbers would need a public, read-only aggregate. |

**Found during this pass**

| ID | Sev | Finding | Status |
|---|---|---|---|
| N-1 | P2 | If the browser's storage blocks Firebase Auth from starting, every page showed "Loading…" forever and sign-in did nothing | **Fixed** — after 12 s a message with a Reload button replaces the spinner (`hooks/useAuth.ts`, `components/AuthProvider.tsx`). Reproduced and verified. |
| N-2 | P2 | **Regression from my own L-8 fix.** The page-level fade animation used `transform`, which makes the animated container the positioning box for the fixed-position dialogs inside it. The Add Funds dialog rendered ~800–1,800 px below the viewport whenever the animation was running or paused. | **Fixed** — page fade is opacity-only. Both admin dialogs re-measured at all 7 sizes. |
| N-3 | P2 | Light-theme contrast: small grey labels as low as 1.5:1–2.6:1; some 4.39:1 | **Partly fixed** — the worst cases fixed (dashboard and worker captions, tabs, green KPIs, my new verify button). Remaining borderline cases need a design-level palette change (§15.12). |
| N-4 | P2 | Expense receipts were stored on the issue document, which every signed-in user can read | **Fixed** for new claims — receipts live in `issues/{id}/receipts/receipt`, readable only by the assigned worker and admins (verified). **Receipts already in the live database remain readable** until migrated (§15.14). |
| N-5 | P2 | The rules let an admin write any ledger entry, so a buggy or malicious admin client could still pay a claim twice | **Fixed** — a ledger entry must, in the same commit, move its claim from pending to approved, for exactly the claimed amount and payee |
| N-6 | P3 | Admin and worker dashboards had no `<h1>` | **Fixed** (screen-reader heading) |
| N-7 | P3 | No guaranteed visible keyboard focus on unstyled controls | **Fixed** — global `:focus-visible` outline; verified with real Tab key presses |

### 15.2 Worker registration — decision and implementation

**What workers could do (before):** claim any open issue, move their own tasks Open → In Progress → Resolved, file expense claims (paid only after admin approval), and read their own payouts. No admin capabilities. Anyone could become one by ticking "Maintenance Worker" at sign-up.

**Decision:** your brief stated the preferred model (worker = admin-approved), and the code had no contrary signal: worker earnings come from the admin-controlled budget and the admin dashboard already ranks workers. So I implemented that model rather than leaving it open.

**Flow:**

```text
Register, ticking "Maintenance Worker"
  → profile created as role "user", workerRequest "pending"
  → dashboard shows "waiting for an administrator's approval"; no worker access
Admin dashboard → Worker Access → Worker Requests → Approve / Reject
  → Approve sets role "worker" (only an admin can write this field)
Admin → Current Workers → Remove Access (revoke)
```

**Enforced in `firestore.rules`:**
- a new profile must have `role: "user"`;
- `workerRequest` may only be `"pending"` at creation;
- only an admin can change `role` or `workerRequest`.

**Verified:**
- Rules tests: a new account cannot register as a worker, cannot approve itself, gains no worker powers while pending, and loses them when revoked.
- Browser: request → approve → worker dashboard unlocked.
- Direct REST calls with the pending account's token: claiming an issue, setting `role`, and approving its own request were all `PERMISSION_DENIED`.

**Existing data:** accounts that self-registered as workers under the old rules still have `role: "worker"`. They appear under *Current Workers*, where an admin should review them (human action 2).

### 15.3 Authorization final check (rules, not UI)

| Attempt | Result | Evidence |
|---|---|---|
| Client changes its own or another user's `role` | Denied | rule tests; REST with student and worker tokens |
| Client writes, updates or deletes `admins/{uid}` (any role, including admin) | Denied | rule tests; REST |
| User creates their own admin document | Denied | rule tests; REST |
| Direct URL `/admin`, `/worker` as student or pending worker | Redirected, and the underlying reads are denied | browser + REST |
| User reads another user's profile, the budget, or the user list | Denied | rule tests; REST |
| Worker reads the budget or user list, or approves or inflates their own claim | Denied | REST with the worker's token |
| User reads all issues | **Allowed by design** (community feed); anonymous denied | rule test |

### 15.4 Issue lifecycle and offline behaviour

The application's states are `Open → In Progress → Resolved`. A new rules test tries **every** ordered pair of states as the assigned worker and as an admin:
- allowed: Open → In Progress, In Progress → Resolved;
- denied: Open → Resolved, In Progress → Open, Resolved → Open, Resolved → In Progress, plus invalid values and any change by a non-assignee.

**Offline (M-15):** with the Firestore emulator killed mid-submit, the AI chat report failed after about 10 s with "The service is unreachable right now…" and stayed on the confirm step so it can be retried. No queued write, no false success.

### 15.5 Image storage (M-16) — evaluation and change

| | Before | After |
|---|---|---|
| Where full photos live | Inside the issue document (≤ 3 × 220 KB of base64) | `issues/{id}/images/{0..2}`, one document each (≤ 220 KB each, about 165 KB binary) |
| What the issue document carries | All photos (and the receipt, up to 250 KB) | Thumbnails only, ≤ 24 KB of base64 each |
| Worst-case issue document | ≈ 910 KB (close to the 1 MiB cap) | ≈ 80 KB |
| Measured: an issue with 3 photos | — | 27 KB document, plus 21 KB, 1 KB and 188 KB image documents |
| Explore feed (100 issues), worst case | ≈ 91 MB | ≈ 8 MB |
| Admin window (300 issues), worst case | unbounded × 0.9 MB | ≈ 24 MB |

Lists show thumbnails; full photos load on demand (issue page, or tapping a thumbnail). Issues created before this change still display, read from their in-document images.

**Why not Firebase Storage:** it is the better design at large scale, but the owner removed Storage in commit `d08cc12`, and new Storage buckets require the paid Blaze plan. That is a billing decision, so I stayed within Firestore.

### 15.6 Admin dashboard (M-17)

The repository gives no expected issue volume. I assumed hundreds to low thousands per term.

- **Live window:** the newest 300 issues (`ADMIN_ISSUE_WINDOW`) feed the charts. A note appears when the total exceeds the window.
- **Exact totals:** "Total Issues" and "Pending Issues" come from server-side aggregate counts (`getCountFromServer`), refreshed when the window changes.
- **Pending claims** have their own live query (`claimStatus == "pending"`), so a claim on an old issue can't fall outside the window.
- **Real time:** preserved for the window, claims and worker requests.

### 15.7 Rate limiting (M-20)

| Operation | Protection now | What's missing / correct architecture |
|---|---|---|
| Login | Firebase Auth's built-in throttling (`auth/too-many-requests`, mapped to a friendly message) | — |
| Registration | Firebase Auth's built-in per-IP abuse limits | App Check + email verification or campus-domain restriction to stop mass sign-ups |
| Issue creation (and its photos) | **Server-side, in the rules:** one issue per 30 s per account. The issue must be committed together with a `rateLimits/{uid}` stamp that can only advance after the cooldown. | Daily caps would need a counter or Cloud Function |
| Image upload | Bounded by the issue rate limit (≤ 3 photos per issue, size-capped) | — |
| "AI" analysis | Runs in the browser; no server cost to abuse | If a real LLM is added, put it behind a rate-limited server route |
| Expense claims | One per resolved task (the lifecycle rules make it single-use) | — |
| Upvotes / chat | One vote per account; chat not throttled | App Check; per-account chat throttle if spam appears |

No client-side "rate limiting" was added and presented as security. Verified by rules tests (second issue rejected; allowed after the cooldown; stamp can't be backdated, forged or written for someone else). The friendly "please wait" message in the UI was **not observed in the browser**: the test harness's own delays exceeded the 30 s window.

### 15.8 Email verification (M-21)

- **Implemented:** a verification email is sent at registration (verified in the Auth emulator's outbox). The dashboard shows a non-blocking banner with "Resend email" and "I've verified".
- **Not implemented — enforcement:** blocking unverified users would lock out every existing account, and whether the product requires verified (or campus-domain) accounts is your decision.
- **To enforce:** add `&& request.auth.token.email_verified == true` to issue creation in `firestore.rules`, after existing users have verified.

### 15.9 Dependencies (M-18)

`npm audit` now reports **0 vulnerabilities**, achieved with two `overrides` in `package.json`. Neither is a major-version upgrade:

| Override | From → To | Why it's safe | Verified by |
|---|---|---|---|
| `@grpc/grpc-js` (under `firebase`) | 1.9.x → 1.14.5 | Same major; used only by Firestore's Node build | All 128 rules tests run through Firestore's Node SDK (gRPC) and pass |
| `postcss` (under `next`) | 8.4.31 → 8.5.28 | Same major; build-time CSS only | `npm run build` passes |

**Caveat:** these pin transitive versions outside what `firebase` and `next` declare. Remove the overrides when those packages ship patched versions. A future `firebase` upgrade should be re-tested with the rules suite.

### 15.10 CSP `'unsafe-inline'` (M-19) — deferred

Removing it needs per-request nonces from middleware. Every page is currently pre-rendered static, so this would make every page dynamic and change the hosting profile. Mitigations in place:
- no user data is ever injected as HTML;
- the CSP blocks third-party script hosts, framing, plugins and foreign form posts;
- Firebase Auth no longer loads `apis.google.com`.

Recommended when you move to a server runtime: Next.js middleware nonce plus `strict-dynamic`.

### 15.11 Payments, receipts and XSS — regression tests

- **Pay once:** six programmatic clicks on "Send Payment" produced 1 ledger entry, budget spent = ₹725.50, worker earnings = ₹725.50, claim `approved`.
- **Pay again:** with the admin's own token, a second ledger entry for the already-paid claim and flipping the claim back to pending were both `PERMISSION_DENIED`.
- **Claims without a photo:** still listed (seeded and tested).
- **Receipt privacy:** an unrelated student got `PERMISSION_DENIED`; the assigned worker and the admin got OK.
- **XSS:** `<script>alert('XSS')</script>` and `<img src=x onerror=alert('XSS')>` were placed in the issue title, description and location, a profile name (shown to admins in Worker Requests, Current Workers, the payment dialog and claim rows), and chat. All rendered as text, with 0 injected elements in the DOM.
  - Category and priority can't carry markup: they are enum-validated in the client and in the rules.
  - "AI" output and admin insights render as React text (C-3 fix).
  - The expense-claim description is not stored.

### 15.12 Image upload — browser test

The test browser can't drive the native file picker, so real `File` objects were generated in the page and delivered to the actual `<input type="file">` through `DataTransfer` and a `change` event. This exercises the real upload code; only the OS picker dialog itself was bypassed.

| Case | Result |
|---|---|
| Large noisy landscape JPEG, 3.0 MB, 2200×1400 | Compressed to 800×509, 188 KB of base64 (stepped down through sizes) |
| Large JPEG, 5.9 MB | Rejected: "Image must be smaller than 5MB." |
| Oversized 6 MB file | Rejected (same message) |
| Portrait PNG, 700×1400, 730 KB | Converted to 640×1280 JPEG, 21 KB |
| Small JPEG, 60×40 | Accepted, 1 KB |
| GIF | Rejected: "Only JPG, PNG or WebP images are allowed." |
| Text file renamed `.jpg` | Rejected: "Couldn't read that image." |
| Fourth image | Upload control hidden at the limit of 3 |
| Receipt: PDF / 3.4 MB JPEG | Rejected / compressed to 600×800, 223 KB |

The photos then persisted as described in §15.5, came back on the issue page at full size (640×1280, 60×40, 800×509), and showed as thumbnails in lists. **Not tested:** a real phone camera and the native picker.

### 15.13 Responsive and accessibility

**Responsive:** automated horizontal-overflow and dialog-fit checks at 320×568, 375×667, 390×844, 768×1024, 1024×768, 1366×768 and 1920×1080, with the page confirmed loaded and signed in at each size:

| View | Sizes passed |
|---|---|
| Login, Register | 7 / 7 |
| Student dashboard, Explore feed, Report form, Issue page | 7 / 7 |
| Worker dashboard | 7 / 7 |
| Worker expense-claim form | 320 and 1920 only |
| Admin dashboard; Payment dialog; Add Funds dialog | 7 / 7 (both dialogs fit and close with Escape at every size) |

Not done: visual screenshot review (the browser pane was hidden for most of the run, so checks were measured rather than looked at), opening the mobile navigation drawer, and the claim form at the middle sizes.

**Accessibility:**
- Verified:
  - every input is labelled; every button has an accessible name; every image has `alt`;
  - one `<h1>` per page (after N-6);
  - real Tab key presses show a visible focus outline;
  - Enter activates controls; Escape closes dialogs;
  - errors use `role="alert"` and statuses use `role="status"`.
- Contrast: measured on the pages where colours resolve (most "glass" surfaces are translucent and can't be measured automatically). Worst failures fixed. Remaining examples: light-theme table headers and tabs at 4.39:1 (just under 4.5), and priority badges at 3.8:1.
- Heading levels skip h2 on the student dashboard (h1 → h3). Not changed.
- **Screen-reader testing: NOT PERFORMED.**

### 15.14 Production configuration review

- No `.firebaserc`, `vercel.json` or `.github/` exists, so there is no default project or pipeline to deploy by accident. `firebase.json` points at the hardened `firestore.rules`.
- `.env.local` (your file, git-ignored) does not enable emulator mode. `NEXT_PUBLIC_ADMIN_EMAILS` in it is unused.
- No test-mode rules remain anywhere: no `allow read, write: if request.auth != null` in the rules or the docs.
- Production build: `X-Powered-By` off; the CSP has no `'unsafe-eval'`. Nothing is logged in a way that includes user data.
- **Compatibility:** the new rules and the new client must be deployed **together**. Issue creation now requires the rate-limit stamp and the thumbnail layout, so the currently deployed client can't create issues under the new rules.
- **Legacy data:** issues created before this change keep their photos and any receipts inside the issue document. Under the new rules those receipts stay readable by any signed-in user until migrated. The fix is a one-off Admin SDK script: move `receiptUrl` into `receipts/receipt`, set `hasReceipt`, and clear `receiptUrl`.

### 15.15 Tests

| Suite | First audit | Now | Change |
|---|---:|---:|---|
| Unit (`npm test`) | 119 | **125 / 125** | +6: thumbnails and image docs, receipt flag, worker-request normalisation, pending request grants nothing, thumbnail validation. One test updated for the new image shape; none removed. |
| Rules (`npm run test:rules`) | 87 | **128 / 128** | +41: worker requests and approval, rate limit, photo subcollection, receipt privacy and single-use, pay-exactly-once, ledger tied to claim, every lifecycle pair, explicit original-exploit list. Tests for the old "register as worker" behaviour were rewritten to assert it is now denied. |
| E2E | — | manual, in browser, against emulators | §15.16 |

### 15.16 Core flows (browser, emulators)

| Flow | Result |
|---|---|
| Student: register (requesting worker access) → pending notice → report with 3 photos → appears once → issue page shows full photos → AI-chat report → track status → logout | PASS |
| Worker: request approved by admin → login lands on worker dashboard → claim → start → resolve with ₹725.50 claim and receipt photo | PASS |
| Admin: dashboard with server counts → filter feed by category and status → approve worker request → open claim (receipt loads on demand) → pay (×6 clicks = 1 payment) → add funds → student sees Resolved | PASS |
| Admin: update or assign an issue from the UI | **Not applicable** — the app has no such screens (it never did). The rules support these operations and tests cover them. |
| Unauthorized: student or pending worker → `/admin`, `/worker`, another user's receipt, admin document, role change, self-approval | Denied (UI redirect + rules) |
| Backend unreachable during submit | Clean failure, retry available |
| Auth start stalled (blocked browser storage) | Message + Reload after 12 s |

### 15.17 Files changed in this pass

- **New:** `components/AccountNotices.tsx`.
- **Deleted (unused):** `services/escalationService.ts`, `services/predictionService.ts`, `services/analyticsService.ts`, `components/ui/Modal.tsx`, `components/ui/Toast.tsx`, `components/ui/Select.tsx`.
- **Modified:**
  - Rules and data layer: `firestore.rules`, `types/index.ts`, `lib/constants.ts`, `lib/models.ts`, `lib/image.ts`, `lib/validation.ts`, `lib/auth.ts`, `lib/firestore.ts`, `lib/finance.ts`, `services/chatService.ts`.
  - Auth: `hooks/useAuth.ts`, `components/AuthProvider.tsx`.
  - Pages: `app/admin/page.tsx`, `app/worker/page.tsx`, `app/dashboard/page.tsx`, `app/issues/[id]/page.tsx`, `app/register/page.tsx`, `app/globals.css`.
  - Components: `components/IssueForm.tsx`, `components/IssueCard.tsx`.
  - Config and tests: `package.json`, `package-lock.json`, `.gitignore`, `tests/unit/*.test.ts`, `tests/rules/firestore.rules.test.ts`, this report.

### 15.18 Git safety

- 52 tracked files changed, 23 new files (listed by `git status`). Nothing staged, committed or pushed.
- Reviewed for secrets: the live API key appears nowhere; the only "password" strings are test fixtures (`campus2024` in a unit test; emulator accounts are created at runtime and not stored).
- No `console.log`, `debugger` or `.only` left in source or tests.
- No whitespace-only file changes (about 150 lines of trailing-whitespace normalisation inside files that were edited anyway).
- A stray test-runner output folder (`.vitest/`) was removed and added to `.gitignore`. Temporary emulator files were deleted.
- Your pre-existing uncommitted edits (`app/admin/page.tsx` import, `app/login/page.tsx` helper) are preserved inside the larger changes.

---

```
FINAL AUDIT STATUS

Critical:
Found: 3
Fixed: 3
Open: 0

High:
Found: 10
Fixed: 10
Partial: 0
Open: 0

Medium:
Found: 26   (21 from the first audit + 5 found in this pass)
Fixed: 22
Partial: 3   (M-20 rate limiting, M-21 email verification, N-3 contrast)
Open: 1      (M-19 nonce-based CSP, deferred)

Low:
Found: 11   (9 + 2)
Fixed: 8
Partial: 0
Open: 3      (L-6 and L-7 documented, L-9 product decision)

Build: PASS
TypeScript: PASS
Lint: PASS
Unit Tests: 125/125
Firestore Rules Tests: 128/128
E2E: PARTIAL   (all existing flows pass; UI rate-limit message not observed; real camera/native picker not tested)
Responsive: PARTIAL   (7/7 sizes pass automated checks on every main view; no visual review; mobile drawer not opened)
Accessibility: PARTIAL   (structure and keyboard verified; some contrast remains; screen reader NOT PERFORMED)
npm audit: 0 findings   (via two non-major overrides, see 15.9)

Firestore rules deployed: NO

Production status:
READY FOR HUMAN VERIFICATION BEFORE DEPLOYMENT
The live application is NOT production-secure today: the deployed rules are still the
original allow-all rules. The code in this working tree is ready to be verified and
deployed by a person, once the actions below are done.

Human actions required:
1. Create admins/{uid} in the Firestore console for each real administrator, before deploying the rules.
2. Review existing accounts with role "worker" (self-registered under the old rules) in
   Admin → Worker Access → Current Workers; remove access for any that shouldn't have it.
3. Deploy firestore.rules and the new app together (the old client can't create issues
   under the new rules), then smoke-test: login, report with a photo, worker claim, admin payment.
4. Migrate legacy receipts out of issue documents (receiptUrl → receipts/receipt) with a one-off Admin SDK script.
5. Decide: enforce email verification and/or restrict sign-up to the campus domain; enable App Check.
6. Set the password policy in Firebase Authentication, restrict the web API key to your domains,
   and delete NEXT_PUBLIC_ADMIN_EMAILS from .env.local.
7. Test photo upload with a real phone camera, and do a screen-reader pass.
8. Commit the work when satisfied (nothing has been committed).
```

---

# Advanced Features Implementation

*Pass date: 2026-10-03. Scope: the "Advanced Intelligence + Automation + Analytics" request. Nothing was deployed, committed or pushed; the live Firebase project was not touched. All end-to-end testing used the local emulators (`demo-unifix`).*

## A1. What was added

| Feature | Where | Notes |
|---|---|---|
| Issue intelligence | `services/aiService.ts` (`analyzeIssueDetails`), `components/report/AnalysisSummary.tsx`, `components/issue/AnalysisPanel.tsx` | Category, priority, **heuristic** confidence (0.30–0.95, labelled "not a probability"), an explanation built from the matched keywords, an extractive summary (reports ≥ 160 chars) and the suggested department. Keyword-based; no model. Failure falls back to General/Low and never blocks the report. |
| Duplicate detection | `lib/intelligence/similarity.ts`, `components/report/DuplicateCheck.tsx`, `components/issue/IncidentPanel.tsx` | 55% wording (synonym-folded Jaccard) + 35% place (QR id, or building + room) + 10% category; threshold 0.55; open issues from the last 14 days (≤ 300 rows). Suggest only: "View existing", "Same problem — link my report", "Report anyway". |
| Incident clusters | `duplicateOf` field + `confirmedClusters` / `suggestClusters` | A master report plus linked reports; every student keeps their own report, status and notifications. Admins can confirm a suggested cluster, or link and unlink from the issue page. Chained incidents are prevented (in the client and in the suggestion logic). |
| Campus map | `lib/campus.ts`, `components/admin/CampusMap.tsx`, `app/admin/map` | A schematic 100×64 layout grid (explicitly "not GPS") with heat shading by open or total issues, filters, keyboard-selectable buildings, a list/table view, and a detail panel with the building's issues. Unmatched locations are counted as "couldn't be placed", never guessed. |
| QR reporting | `lib/locations.ts`, `app/admin/locations`, `app/dashboard/report?location=` | Admins create locations (slug ids); the QR code is generated client-side (`qrcode`), with PNG download and a print layout. Scanning while signed out goes to login, then back to the report (safe `?next=`). An unknown or removed location shows a notice and falls back to manual entry. |
| Analytics | `lib/intelligence/analytics.ts`, `ranges.ts`, `app/admin/analytics` | Presets: Today, 7/30/90 days, Semester (assumed Jan–Jun and Jul–Dec, documented) and Custom (validated, ≤ 366 days). Filters: category, building, status, priority, worker, department. KPIs, reported vs resolved, category, status, priority, resolution by category, SLA counts, buildings, satisfaction. |
| SLA engine + escalation | `lib/intelligence/sla.ts`, `config/sla`, `components/issue/SlaBadge.tsx` | Admin-configurable whole-hour targets (High ≤ Medium ≤ Low). The state is **computed** from timestamps at render time and never stored. Escalation = an admin sets the existing `escalated` flag; escalated and at-risk tasks are listed first on the worker dashboard ("Needs attention"). No push or email, since there is no server. |
| Worker recommendation | `lib/intelligence/assignment.ts`, `components/issue/AdminIssueControls.tsx` | Ranked by category experience (90 days), workload and ratings (≥ 2 needed), each with a plain-language reason. The admin decides; the rules still require the assignee to be an approved worker or an admin. Workload is visible to admins only. |
| Maintenance Risk Indicator | `lib/intelligence/maintenance.ts` | A rule-based score from frequency, recurrence, recency and high-priority share. Shows "not enough data" below 10 issues or 14 days of history; a place needs ≥ 3 issues to be scored. The inputs are shown next to each result. |
| Feedback & satisfaction | `lib/feedback.ts`, `components/issue/FeedbackPanel.tsx`, `components/FeedbackRequests.tsx` | The reporter rates their own Resolved issue once (rules-enforced). Admins see the aggregated distribution; exports contain ratings only (no reporter ids, no comments). |
| Notification centre | `lib/notifications.ts`, `hooks/useNotifications.ts`, `components/NotificationBell.tsx` | Bell with unread count in TopNav and Sidebar; All/Unread, mark read, mark all read, open the related item; closes on Escape or an outside click and returns focus to the bell. One shared, reference-counted listener (limit 50). Types: issue assigned, status changed, worker access decision, claim decision. |
| Issue timeline | `lib/timeline.ts`, `components/issue/IssueTimeline.tsx` | Events are written in the same transaction as each change. Issues created before this pass show only their own timestamps, labelled as such; no invented history. |
| Role-specific dashboards | `app/admin/*` tabs, `app/worker`, `app/dashboard` | Admin: Overview / Analytics / Map / Finance & Workers / Locations & Settings. Worker: SLA badges and "Needs attention". Student: SLA badge on own issues and "How did we do?" prompts. |
| Exports | `lib/export.ts` | CSV (formula-injection safe) and JSON for issues, workload, SLA, feedback ratings and maintenance risk. No reporter names, emails or uids. |
| Global search | `lib/search.ts`, `app/search` | Matches ID (exact or prefix), title, location, category and synonyms, with filters, over the newest 1000 issues (projection). An exact issue ID is always looked up directly. |
| Insights | `lib/intelligence/insights.ts` | Factual sentences only; each says "Not enough historical data…" when its threshold isn't met. |
| Campus Operations overview | `app/admin/page.tsx` | KPIs from server counts and real rows, compact map, SLA alerts with Escalate, confirmed and suggested incidents, risk, workload, insights. |
| Landing page | `app/page.tsx` | The fabricated stats ("500+ issues resolved", "98% satisfaction", "< 2hr", "24/7") were replaced with capability statements, and the "AI-powered" wording with accurate wording. |
| Honest labelling | `services/aiAssistService.ts`, worker page | The worker "AI Insight" was a keyword tip with an artificial 300 ms "realism" delay. It is now labelled "Suggested checks (keyword-based tip)", the delay is gone, and matching uses whole words in the description and category only. |
| Seed data | `scripts/seed-emulator.mjs`, `npm run seed:emulator` | Emulator-only: refuses unless both hosts are local and the project id starts with `demo-` (verified: it refuses `unifix-prod` and a remote host). |

## A2. Architecture decisions (no server)

- **Writes that need a "server"** (notifications, timeline events) are written by the acting client *in the same transaction* as the change. The rules use `get()`/`getAfter()` to accept them only when the matching change happens in that commit. Single-occurrence events use fixed document ids, so they can't be duplicated.
- **Notifications contain no free text.** The message is rendered from the type and rule-validated fields, so a sender can't put arbitrary words (e.g. phishing links) in front of a recipient.
- **SLA is computed, never stored**, so it can't be forged. The only stored inputs are timestamps (rules-controlled) and the admin config.
- **Reads are bounded everywhere.** Analytics, map, search and duplicates use REST `runQuery` with a field projection (no descriptions, photos or vote lists) and hard limits (`QUERY_LIMITS`: analytics 2000, search 1000, duplicates 300, feedback 500, notifications 50). The UI says when a cap was reached. The live admin window stays at the newest 300 issues. Incidents are derived from `duplicateOf`, with no extra collection.
- **Listeners:** every `onSnapshot` goes through `track()`. SLA config and notifications each use one shared, reference-counted listener.
- **CSP:** investigated; no change needed. `img-src data:` covers QR images and `connect-src https://*.googleapis.com` covers the REST queries; the emulator hosts are dev-only. Nonce-based CSP remains deferred (M-19).

## A3. Security changes (with tests)

All new permissions were added narrowly to `firestore.rules`. No rule was loosened and no `request.auth != null` shortcut was added. There are 44 new rule tests in `tests/rules/advanced.rules.test.ts`, and the existing 128 still pass:

| Area | Allowed | Denied (tested) |
|---|---|---|
| New issue fields | On create, the reporter may set `aiSummary` (≤ 300), `aiConfidence` (0–1), `aiDepartment` (enum), `locationId` (must exist) and `duplicateOf` (must exist, not self), still under the 30 s rate limit | Out-of-range or unknown values, a non-existent location or issue, self-links, setting them after creation as a non-admin |
| Assignment / linking | Admins assign only to an approved worker or an admin, never reassign a Resolved issue, and can link/unlink incidents | Assigning to a student or an unknown uid; a student or worker changing `assignedTo`, `duplicateOf` or `escalated` |
| Timeline events | The actor writes the event tied to the real change in the same commit | Free-standing or mismatched events, a wrong `actorRole`, edits or deletes |
| Notifications | Written by the actor of a matching change; the recipient reads, marks read once, deletes | Free-text fields, a spoofed `senderId`, notifications without a matching change, reading others' notifications, changing anything but `readAt` |
| Feedback | The reporter, once, on their own Resolved issue; the author and admins can read | Rating others' issues or unresolved ones, a second rating, edits, a non-integer or out-of-range rating, listing others' feedback |
| `campusLocations`, `config/sla` | Admin writes (validated); signed-in users read | Any non-admin write; invalid ids or hours |

Browser attack check, using a student's own ID token for direct REST calls against the emulator: escalate, reassign, write SLA config, create a QR location, send a free-text notification, re-rate, list others' feedback, write a fake timeline event, self-grant admin. **All 9 returned 403**; reading the student's own feedback returned 200.

AI/heuristic output is only ever stored as validated optional fields. It cannot change roles, approve workers or payments, or bypass the rules.

## A4. Database changes

- **Issues:** new optional fields `aiSummary`, `aiConfidence`, `aiDepartment`, `locationId`, `duplicateOf`. Older issues work unchanged, with fallbacks.
- **New:** `issues/{id}/events/*`, `notifications/*`, `feedback/{issueId}`, `campusLocations/{id}`, `config/sla`.
- **Index:** `notifications (recipientId ASC, createdAt DESC)` in `firestore.indexes.json`. It **must be deployed**, or the bell shows "couldn't be loaded".
- **No migration required.**

## A5. Bugs found and fixed while testing this pass

| # | Found by | Problem | Fix |
|---|---|---|---|
| AF-1 | Browser (800 px) | The notification panel was anchored to the bell and ran off-screen when other controls sat to its right | The panel is anchored to the viewport (`fixed`, right- or left-aligned depending on placement) |
| AF-2 | Responsive (320 px) | The top bar overflowed for multi-role accounts (role select + search + bell) | The role select is hidden below `sm`; the mobile menu already has a role switcher |
| AF-3 | Responsive (320 px) | The issue-card badge row (with the new SLA badge) was clipped | Badges wrap under the title on small screens |
| AF-4 | Browser (chat) | The chat parser took "room since" as the location (any word after "room") | New `extractLocation`: room/lab/hall need an id-like token and block needs a letter or number; known buildings are recognised. Unit tests added |
| AF-5 | Browser (worker) | A door/lock repair tip was shown for "Block A" (the substring "lock"), and the location text was being matched | Whole-word rules on the description and category only. Unit tests added |
| AF-6 | Review | Suggested clusters could include a confirmed incident's main report, which would chain incidents | Excluded. Unit test added |
| AF-7 | Browser | The SLA insight (90-day data) and the SLA KPI (live window) looked contradictory | The insight now says it covers "issues reported in this period" |
| AF-8 | Review | The old admin page had a hard-coded 8 h "SLA" and fabricated insights ("requests remain uniformly distributed" with no data) | Removed, and replaced by the configurable SLA engine and factual insights. The old page moved to `/admin/finance` (budget, claims and worker access unchanged) |
| AF-9 | Review | `AdminGuard`/`WorkerGuard` lost the requested page when redirecting to login | They now pass a validated `?next=`, like `ProtectedRoute` |

---

# Advanced Feature Verification

Environment: Firebase Emulator Suite (auth + firestore, project `demo-unifix`), Next.js dev server, built-in browser. Data seeded with `scripts/seed-emulator.mjs`.

| Feature / check | Status | Evidence |
|---|---|---|
| AI analysis on report (form + chat): category, priority, confidence, explanation, department, summary | PASS | Browser: "Classified as Cleanliness because the report mentions "garbage" and "smell"…"; unit tests |
| AI failure doesn't block reporting | PASS (unit) | Fallback path unit-tested; not forced in the browser |
| Duplicate suggestion + "link my report" | PASS | Browser: the existing "Garbage bin overflowing" at the same QR location was suggested; submitted with the link; the rules accepted `duplicateOf` + `locationId` |
| "Report anyway" | PASS | Browser (chat): submitted with the default choice |
| Incident panel / confirmed clusters on Overview | PASS | Browser: 5 confirmed incidents listed |
| Admin "Link as one incident" / link / unlink buttons | PARTIAL | Rules and unit tests cover linking; the buttons themselves were **not clicked** in the browser |
| QR: create location, QR preview, download link present | PASS | Browser: "Chemistry Lab…" created; QR image and PNG data link rendered |
| QR: PNG actually downloaded / print dialog / real phone scan | NOT TESTED | No file downloads or print dialogs triggered; no physical phone |
| QR link → login → back to report with location preset | PASS | Browser: `/login?next=…` → signed in → report page with "Location from QR code" |
| Safe redirect (`next`) | PASS | 4 unit tests (external URLs, `//host`, backslashes and login loops rejected) |
| Campus map (filters, keyboard select, list view, detail) | PASS | Browser: Enter on the focused "Canteen" building opened its detail; list view toggle |
| Analytics presets 30/90/semester, filters, charts | PASS | Browser. Custom-range validation is unit-tested; the custom inputs weren't exercised in the browser |
| Exports CSV/JSON | PASS | Browser: blobs captured in the page (no download); headers correct, no reporter identity columns |
| SLA config save + validation | PASS | Browser: an invalid value (High > Medium) was rejected with a message; a valid one saved |
| SLA badges / alerts / worker "Needs attention" ordering | PASS | Browser (admin + worker) |
| Escalation | PASS | Browser: admin escalation accepted by the rules; a student's REST attempt → 403 |
| Worker recommendation + assign | PASS | Browser: ranked list with reasons; assigned; timeline event and worker notification created |
| Maintenance risk + insufficient-data states | PASS | Browser (indicators shown with their inputs); thresholds unit-tested |
| Feedback (once, own issue) + satisfaction analytics | PASS | Browser: rated 4★; a second rating via REST → 403; distribution shown on Analytics |
| Notifications: bell, unread, All/Unread, mark read, mark all, open, Escape focus return | PASS | Browser (worker and student) |
| Timeline (real events, legacy fallback) | PASS | Browser: reported → assigned → started → resolved → rated |
| Global search (synonyms, ID lookup) | PASS | Browser: "internet library" found WiFi issues; ID lookup unit-tested |
| Landing page without fake stats | PASS | Browser: none of 500+ / 98% / < 2hr / 24/7 present |
| 30 s rate limit preserved | PASS | Browser: a second report within 30 s was rejected; rules tests |
| Security matrix (student vs new features) | PASS | 9/9 REST attacks → 403; 44 new rule tests |
| Listener leaks (A→B→A→B) | PASS | `__unifixListeners`: Overview 3 ↔ Finance 5 (twice), Analytics 2, Map 1, issue page 5 → back to 3 (twice); counts return to baseline |
| Performance at 100 / 500 / 1000 issues | PASS | See the table below |
| Responsive (7 widths) | PARTIAL | Admin pages: 5 pages × 7 widths (320/375/414/768/1024/1280/1440), 0 overflow after the fixes. Student/shared pages: 320 px (dashboard, issue, search, report), 768 and 1440 px (issue, search), 0 overflow. Not every page was checked at every width |
| Accessibility | PARTIAL | Automated DOM audit on 7 pages: 0 images without alt, 0 unnamed controls, 0 unlabelled inputs, 0 duplicate ids, one h1 each. Keyboard use of the map and the bell verified. Colour contrast not measured; screen reader NOT PERFORMED |
| Visual regression of existing pages | PARTIAL | Landing, login, dashboards, issue page and finance page reviewed visually at desktop and mobile; no pixel-diff tooling |
| Composite index in real Firestore | NOT TESTED | The emulator doesn't enforce indexes; must be deployed and checked |
| REST projection queries against production Firestore | NOT TESTED | Verified on the emulator only (same API; the CSP allows the host) |

### Performance (dev server, emulator, desktop browser)

| Issues seeded | Overview fully loaded | Analytics 30 d | Analytics 90 d (rows) | Semester | Map |
|---|---|---|---|---|---|
| 100 | 0.68 s | 0.53 s | 1.99 s (88)* | 0.83 s | 0.88 s |
| 500 | 0.81 s | 0.77 s | 0.22 s (410) | not measured | 0.37 s |
| 1000 | 0.92 s | 0.44 s | 0.49 s (829) | 0.28 s (851) | 0.36 s |

\* First fetch after a dev recompile.

- **Search over 1000 issues:** ready about 1.5 s after navigation (including auth startup); re-filtering takes about 56 ms.
- **Live admin window:** stays capped at 300 at 1000 issues (verified "newest 300").
- **Projection payload for 1000 rows:** 0.99 MB vs 1.86 MB for full documents on seed data. Seed issues have no photos, so real issues with thumbnails would save considerably more.
- Production-build timings were not measured.

### Test totals (final run)

- TypeScript: PASS · Lint: PASS · Build: PASS (17 routes)
- Unit tests: **181 / 181** (6 files)
- Firestore rules tests: **172 / 172** (128 core + 44 advanced)
- npm audit: **5 high, all dev-only.** They are one advisory, `braces` GHSA-vfj7-8cjw-p6xm, reached through `eslint-config-next` → `fast-glob` → `micromatch`, and published after the previous pass. The only offered fix downgrades `eslint-config-next` to 14.x, a breaking change, so it was not applied. `npm audit --omit=dev`: **0 vulnerabilities**.

## A6. Limitations

- **No backend:** no scheduled escalation, email/push notifications or server-side aggregation. Admins learn about new issues from dashboard data, not stored notifications.
- **Capped windows:** analytics, search and duplicates work on the most recent 2000 / 1000 / 300 rows. The UI says when a cap was reached.
- **Heuristic, English-only intelligence:** all of it is keyword/heuristic logic, and the confidence is not calibrated.
- **Schematic map:** `lib/campus.ts` must be edited to match the real campus. Free-text locations that don't match a building are shown as unplaced.
- **Assumed semester boundaries:** Jan–Jun and Jul–Dec.
- **Feedback comments:** visible to admins on the issue page but excluded from exports.
- **QR codes:** they encode the origin they were generated on, so generate them from the production URL.

## A7. Files changed in this pass

- **New:**
  - Pages: `app/admin/{analytics,map,finance,locations}/page.tsx`, `app/search/page.tsx`.
  - Components: `components/NotificationBell.tsx`, `components/FeedbackRequests.tsx`, `components/admin/{AdminTabs,CampusMap,Kpi}.tsx`, `components/issue/{Panel,SlaBadge,IssueTimeline,AnalysisPanel,IncidentPanel,FeedbackPanel,AdminIssueControls}.tsx`, `components/report/{AnalysisSummary,DuplicateCheck}.tsx`.
  - Hooks: `hooks/{useSlaConfig,useNotifications,useNow,useCampusLocations}.ts`.
  - Library: `lib/{campus,export,feedback,firestoreRest,listeners,locations,navigation,notifications,search,timeline}.ts`, `lib/intelligence/{similarity,sla,analytics,maintenance,assignment,insights,ranges}.ts`.
  - Tooling and tests: `scripts/seed-emulator.mjs`, `firestore.indexes.json` (index added), `tests/unit/{intelligence,navigation,aiAssist}.test.ts`, `tests/rules/advanced.rules.test.ts`.
- **Modified:**
  - Rules, types and data layer: `firestore.rules`, `types/index.ts`, `lib/{constants,models,firebase,firestore,finance}.ts`, `services/{aiService,aiAssistService,chatService}.ts`.
  - Pages: `app/admin/{layout,page}.tsx` (the page was rewritten as the Overview; its previous content moved to `finance`), `app/{page,login/page,dashboard/page,dashboard/report/page,worker/page,issues/[id]/page,globals.css}`.
  - Components: `components/{TopNav,Sidebar,IssueCard,IssueForm,ChatReporter,ProtectedRoute,AdminGuard,WorkerGuard}.tsx`.
  - Tests, config and docs: `tests/unit/aiService.test.ts`, `package.json` (+`qrcode`, `@types/qrcode`, `seed:emulator` script), `package-lock.json`, `README.md`, `FIRESTORE_RULES_FIX.md`, this report.
- **Cleanup:** temporary files (`.env.development.local`, preview launch config) were removed; the emulators and dev server were stopped.

---

```
SMART CAMPUS ADVANCED FEATURES — FINAL STATUS

Features requested: 20+ (intelligence, duplicates, incidents, map, QR, analytics, SLA,
  escalation, recommendations, risk, feedback, notifications, dashboards, timeline,
  issue intelligence, exports, search, insights, operations overview, landing page)
Implemented: all
Verified in browser (emulators): all except the items marked PARTIAL / NOT TESTED above

Build: PASS
TypeScript: PASS
Lint: PASS
Unit Tests: 181/181
Firestore Rules Tests: 172/172   (44 new)
E2E (emulators): PASS for student, worker and admin flows; PARTIAL — incident link/unlink
  buttons not clicked, QR download/print and real phone scan not tested
Security matrix: PASS   (9/9 direct REST attacks denied; no rule loosened)
Listener leak test: PASS
Performance (100/500/1000): PASS   (all admin views < 1 s at 1000 issues, dev mode)
Responsive: PARTIAL   (admin: 5 pages x 7 widths clean; other pages at up to 3 widths)
Accessibility: PARTIAL   (automated structure + keyboard; no contrast measurement, no screen reader)
npm audit: 5 high (dev-only, braces chain; breaking fix not applied) · production deps: 0

Firestore rules deployed: NO
Firestore indexes deployed: NO
Committed / pushed: NO

Production status:
READY FOR HUMAN VERIFICATION BEFORE DEPLOYMENT

Human actions required (in addition to §15):
1. Deploy firestore.rules AND firestore.indexes.json together with the new app build.
2. Edit lib/campus.ts to match your real buildings (the map and building analytics depend on it).
3. Review the default SLA targets (High 6 h, Medium 24 h, Low 72 h) in Admin → Locations & Settings.
4. Confirm the semester dates (lib/intelligence/ranges.ts) match your academic calendar.
5. Create QR locations from the production site, then print and test-scan one with a phone.
6. Smoke-test on the real project: bell loads (index), analytics loads, link a duplicate, rate a fix.
7. Decide whether to accept the dev-only braces advisory until eslint-config-next ships a fix.
8. Commit when satisfied (nothing has been committed).
```

---

# UI/UX Transformation

Goal: one consistent, restrained "campus operations" interface across all roles, without changing application logic, the data model, authorization or the security rules.

## U1. Design system

- **Tokens (`app/globals.css`, Tailwind v4 `@theme`):**
  - Semantic colours: canvas / surface / surface-2, fg / fg-muted / fg-subtle, brand (deep campus blue), and success / warning / danger, each with subtle and border variants.
  - Every token is redefined under `.dark`, so components need no `dark:` variants.
  - Radius sm–xl; four elevation levels; a six-step heat scale with a matching "ink" colour per step (≥ 4.5:1 in both themes).
  - Motion: 120–180 ms for hover, press, menus and toasts; 250 ms for dialogs and drawers. A global `prefers-reduced-motion` rule removes movement but keeps every state change.
- **Removed:** the unused `tailwind.config.ts` (old purple palette), all gradients, glass effects, `rounded-2xl` and `font-black`, and every "AI-powered" flourish.
- **Component library (`components/ui/`):**
  - `Button` / `IconButton` / `buttonClasses`: 5 variants, 3 sizes, loading state. While loading, the button stays focusable and ignores clicks, because a natively disabled button drops focus.
  - `Field` (Input, Select, Textarea, with label, hint, error and valid states), `Badge` / `StatusBadge` / `PriorityBadge`, `Card`, `PageHeader` / `SectionHeader`.
  - `States`: Skeleton, Spinner, EmptyState, ErrorState with retry, Notice.
  - `Dialog` / `ConfirmDialog` (alertdialog; Cancel focused first), `Drawer`.
  - `Toast` (polite and assertive live regions), `Menu` (menu-button pattern), `Tabs` (tablist with optional tabpanel wiring), `Segmented`.
  - `Data` (StatStrip, TableWrap, DescriptionList, Tooltip), `UpvoteButton`.
- **Hooks:**
  - `useOverlay`: focus trap, Escape, scroll lock, an overlay stack, and focus return. If the opener has disappeared, focus goes to `main`.
  - `useChartTheme`: chart colours per theme.
- **Shell (`components/shell/`):**
  - Role-based sidebar (Admin: Operations / Management / Configuration).
  - Sticky top bar with search, the Ctrl/⌘K command palette, notifications, theme toggle and the account menu with "View as".
  - Off-canvas drawer on mobile; skip link; content capped at 1200 px.

## U2. Pages

- **Public and auth:**
  - Landing rewritten with a factual hero, the product preview labelled as an illustration, "How it works", capabilities and security facts, and no statistics.
  - Login (inline validation, password reset), Register (role radiogroup), Switch role, 404 and error pages.
- **Student:**
  - Dashboard with My issues / Community tabs, KPI strip, filters, and empty, error and loading states.
  - Report flow: one page in three steps, live "Suggested details", inline duplicate check, sticky submit bar on mobile, Quick report.
  - Issue detail: description, timeline, discussion, details, SLA meter, analysis, incidents, feedback.
- **Worker:** KPI strip, "needs attention" notice, My tasks / Open pool / Payouts, and a resolve dialog with an optional expense claim.
- **Admin:**
  - Overview: trend chart, needs attention, hotspots, risks, incidents, insights.
  - New Issues table, with a filter drawer on mobile and a "Needs attention" view.
  - Analytics (range, filters, Export menu), Campus map (building panel or bottom sheet).
  - New Workers page (access requests and team table).
  - Finance: review → confirm payment, reject, add funds.
  - Locations & QR, and the new Settings page (SLA targets).
- **Copy:** plain language throughout ("Due soon", "Overdue", "Me too", "Suggested category"), with no confidence-score marketing.

## U3. Problems found and fixed during UI verification

| # | Problem (found in the browser) | Fix |
|---|---|---|
| UI-1 | `hidden sm:inline-flex` on components lost to the component's own `inline-flex`, so the landing header overflowed by 53 px at 320 px and both chat Send buttons showed | `max-sm:hidden` (3 places) |
| UI-2 | Admin Overview and Analytics overflowed at 320 px: implicit grid tracks grew to min-content | `grid-cols-1` on the mobile grids |
| UI-3 | Add funds dialog showed "Please enter an amount…" on open: `autoFocus` and then the overlay moved focus, and the blur marked the field touched. `autoFocus` also broke focus return | `initialFocus` refs (Add funds, Add location); the overlay keeps focus that is already inside it |
| UI-4 | Loading buttons dropped keyboard focus to `<body>` (start work, pay, submit feedback) | Loading uses `aria-disabled` and swallows clicks, so there is no double submit and focus is kept |
| UI-5 | Focus fell to `<body>` when the opener vanished after an action (paid claim, resolved task, deleted location, submitted rating) | Fallback to `main`; the worker list and feedback panel receive focus explicitly |
| UI-6 | Repeated identical control names ("Assign" ×3, "Escalate" ×12, "This affects me too" ×100, Start, Resolve, Claim, Review, Rate, Mark read) | Accessible names now include the worker or issue (and location for votes) |
| UI-7 | Confirmations announced as plain dialogs; the Export menu had no name; tabs had no tabpanel; worker and dashboard lists skipped h1 → h3 | `alertdialog`; menu labelled by its trigger; tab ↔ tabpanel ids; sr-only h2 |
| UI-8 | Contrast: `--fg-subtle` measured 4.35:1 on surface-2; dark-mode map tiles had white on light blue (2.5:1); light mode used grey on heat level 3 (2.9:1) | `--fg-subtle` changed to `#646b78` (≥ 4.5:1); per-level heat ink (lowest is 4.60:1) |
| UI-9 | The upvote toggle changed its label instead of its state, and dropped focus while saving | Constant label plus `aria-pressed`; `aria-disabled` while saving |

# UI/UX Verification

Environment: Firebase emulators (`demo-unifix`, seeded), Next.js dev server, built-in browser with viewport emulation; accounts admin@, worker3@ and student4@unifix.test (local seed only).

| Check | Status | Evidence |
|---|---|---|
| Responsive, 7 sizes (320×568, 375×667, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080) | PASS | Overflow script (document overflow plus elements beyond the viewport outside scroll containers) → `extra=0 clipped=0` for: `/`, `/login`, `/register`; student `/dashboard`, `/dashboard/report`, `/issues/[id]`, `/search`; `/worker`; admin `/admin`, `/admin/issues`, `/admin/analytics`, `/admin/map`, `/admin/workers`, `/admin/finance`, `/admin/locations`, `/admin/settings`. That is 16 routes × 7 sizes, after fixes UI-1 and UI-2. Community and `/switch-role` were also checked at 320–390 |
| Notifications panel on phones | PARTIAL | Full width on mobile by construction (`left-2 right-2`); opened at 1366 only during this pass |
| Dialogs: focus trap (Tab / Shift+Tab), Escape, scroll lock, focus return | PASS | QR, Add funds, Add location, Assign, Resolve, Claim review, Pay confirm (nested: Escape closes only the confirm), Delete confirm |
| Confirmations: alertdialog, consequence text, Cancel focused | PASS | Delete location, Pay ₹450 ("cannot be reversed") |
| Toasts on success | PASS | Location saved/deleted, Assigned, Work started, Task resolved (with and without claim), Payment completed, Feedback |
| End-to-end flow through the new UI | PASS | Admin assigned → worker started → resolved with a ₹450 claim → admin paid (balance, payouts and pending updated live) → student rated 4★ (timeline updated live) |
| Menus (account, Export): Enter / ↓ opens, arrows, Home / End, Escape returns focus, `aria-expanded` | PASS | Browser |
| Tabs and segmented controls | PASS | Worker and dashboard tabs; tabpanel `aria-labelledby` resolved to the active tab |
| Filter drawer (mobile) | PASS | Live "Show 19 issues", "Filters (1)", "Clear filters", focus returned |
| Map keyboard selection; star rating (radiogroup, arrows, validation) | PASS | Browser |
| Command palette, mobile nav drawer, report flow, password reset | PASS | Verified earlier in this pass (keyboard navigation, Escape, focus) |
| Keyboard focus visibility | PASS | Tabbed 16 stops on `/admin/workers`: each `:focus-visible` with a 2 px brand outline and 2 px offset (`#1e40af` after the 150 ms colour transition) |
| Dark mode (admin pages, charts, map) | PASS | Screenshots plus the automated audit: 0 contrast failures on 7 admin pages and the issue page |
| Automated accessibility audit (names, labels, alt, duplicate ids, single h1, heading order, repeated names, text contrast ≥ 4.5 / 3) | PASS | 0 issues, 0 low-contrast on: 8 admin pages (light), 8 admin and issue pages (dark), `/worker`, student dashboard, Community*, report, issue, search, switch-role, 404 |
| Reduced motion | PARTIAL | The CSS rule is present and reviewed; not emulated in the browser |
| Screen reader | NOT PERFORMED | No NVDA / VoiceOver session |
| QR PNG download / print dialog | NOT TESTED | Not triggered (no downloads) |
| Visual regression | PARTIAL | Screenshots reviewed at desktop and mobile; no pixel-diff tooling |

\* Community after UI-6: remaining repeats came from seed issues with identical titles; the location is now part of the name.

### Regression results (final run, after all UI changes)

- TypeScript `tsc --noEmit`: PASS · ESLint: PASS · `next build`: PASS (19 routes)
- Unit tests: **186 / 186** (7 files; +5 for `cn`, `formatRelative`, `greeting`)
- Firestore rules tests: **172 / 172** (run with `npx firebase-tools emulators:exec`; the `test:rules` script expects a global `firebase` CLI)
- npm audit: 5 high, dev-only (same `braces` chain as before); `--omit=dev`: **0**
- `firestore.rules`, data model and authorization logic: **not changed in this pass**

### Known remaining issues

- The worker's claim "What was it spent on?" text is collected but not stored. This is pre-existing (the original code dropped it too); storing it needs a data-model and rules change.
- Payout rows read "Receipt resolved for …", a pre-existing description string written by `lib/finance.ts`.
- After "Mark read" in the notification panel, the button disappears and focus falls back to the page.
- Seed data repeats titles, so some Community rows look alike (accessible names now differ by location).
- No screen-reader pass, reduced-motion emulation or pixel-diff baseline.

### Files changed in this pass

- **New:**
  - `components/ui/{Field,Dialog,Drawer,Menu,Tabs,States,Data,PageHeader}.tsx`, `components/shell/*`.
  - `hooks/{useOverlay,useChartTheme}.ts`, `lib/cn.ts`.
  - `app/admin/{issues,workers,settings}/page.tsx`.
  - `tests/unit/uiHelpers.test.ts`.
- **Rewritten or restyled:**
  - `app/globals.css`, `app/layout.tsx`.
  - All pages under `app/` (landing, auth, dashboard, report, issue, search, worker, admin/*, error, not-found) and the layouts.
  - `components/{IssueCard,IssueForm,ChatReporter,BillSubmissionForm,FeedbackRequests,NotificationBell,ImageEditor,ImageModal,AccountNotices,ProfileUnavailable,AuthProvider,AdminGuard,WorkerGuard,ProtectedRoute}.tsx`, `components/ui/{Button,Badge,Card,Toast,UpvoteButton,Input,Textarea}.tsx`, `components/issue/*`, `components/report/*`, `components/admin/{CampusMap,Kpi}.tsx`.
  - `lib/{dates,auth,timeline}.ts` (UI helpers, password reset, timeline wording).
- **Deleted:** `components/{TopNav,Sidebar}.tsx`, `components/admin/AdminTabs.tsx`, `tailwind.config.ts`.
- **Dependency:** `lucide-react` (icons, ISC).
- **Docs:** `README.md` (structure and interface), this report.
- **Cleanup:** the temporary `.env.development.local` and preview launch config were deleted; the emulators and dev server were stopped.

```
SMART CAMPUS UI/UX TRANSFORMATION — FINAL STATUS

Design system: implemented (tokens, light/dark, motion, 19 UI building blocks)
Pages redesigned: all (public, auth, student, worker, admin incl. 3 new admin pages)
Responsive: PASS — 16 routes x 7 sizes, 0 overflow
Interaction QA: PASS — dialogs, confirmations, toasts, menus, tabs, drawers, map, rating,
  full assign → resolve → pay → rate flow
Accessibility: PASS for automated checks + keyboard; PARTIAL overall (no screen reader,
  reduced motion not emulated)
Dark mode: PASS (admin pages, charts, map)

Build: PASS · TypeScript: PASS · Lint: PASS
Unit Tests: 186/186 · Firestore Rules Tests: 172/172
npm audit: 5 high (dev-only, unchanged) · production deps: 0

Rules / data model / authorization changed: NO
Deployed: NO · Committed / pushed: NO
```

---

## Final Fixes & Public Viewer Mode

Environment for browser checks: Firebase emulators (`demo-unifix`, seeded with `npm run seed:emulator -- --issues=150 --reset`), Next.js dev server, built-in browser with viewport emulation. Accounts admin@, worker3@ and student4@unifix.test exist on the local emulator only. No production project, data, rules or indexes were touched.

**Testing note.** The browser pane was not painting for most of this pass: screenshots timed out and real keystrokes sometimes failed. Checks were therefore made through the DOM:
- element state, focus (`document.activeElement`), ARIA attributes and layout measurements;
- activation via `.click()`, `form_input` or synthetic `keydown` where real keys failed.

Real Tab, Enter and Escape key presses were used successfully for the guide dialog and the map.

### F1. Expense-claim description is now persisted

- **Model.** An optional `claimDescription` (string, 1–500 characters) is stored on the issue document next to `claimAmount` / `claimStatus`. It is the smallest change: no new collection, and the ledger keeps its existing schema. Its visibility matches `claimAmount`: issue documents are readable by any signed-in user, while receipts stay restricted to the assignee and admins.
- **Client.**
  - `validateClaimDescription` (`lib/validation.ts`) strips control characters, collapses whitespace and caps the text at 500 characters.
  - `submitBill(issueId, worker, amount, receipt, description)` writes the field only when it is non-empty.
  - The form's textarea has `maxLength=500` and a "Shown to administrators" hint.
  - `normalizeIssue` returns `""` for older claims.
- **Rules (`firestore.rules`).** `staffResolve` may now also change `claimDescription`. `validClaim` additionally requires that:
  - it is only written together with a new claim (`claimAmount` + `claimStatus` in the same change);
  - it is a string of 1–500 characters.

  No other update path lists the field. `adminUpdate`'s allow-list excludes it, and `validNewIssue` excludes it at creation. As a result, nobody — the worker, students, other workers or admins — can change it after filing, and a paid claim's amount, payee and description cannot be rewritten. The exactly-once payment rule (`settlesPendingClaim`) is unchanged.
- **Display.**
  - Admin claims table: the category is followed by the description.
  - Review dialog: a new "Spent on" row (or "No description given").
  - Payment history (admin payouts, worker payouts): `approveClaim` writes the ledger `note` as "‹issue› — ‹description›" via `payoutNote` (`lib/claims.ts`).
  - Older "Receipt resolved for …" notes are shown without the prefix (`payoutLabel`).
- **Tests.**
  - Rules: claim with description persists and an admin reads it back; rejected when given without a claim, as non-text, empty, or over 500 characters; a student or another worker can't file it; nobody (worker, student, other worker, admin) can change it afterwards; a paid claim's description, amount, status and payee can't be rewritten.
  - Unit (`tests/unit/claims.test.ts`): validator, ledger wording, legacy notes, and old claims without a description rendering safely.
  - Browser: worker3 resolved "Network very slow" with ₹650 and the description "Replacement Wi-Fi access point patch cable" on a 375 px viewport. The rules accepted the write. The admin claims table and review dialog showed the description. After paying, the payout row read "Network very slow — Replacement Wi-Fi access point patch cable".

### F2. Notification "Mark read" focus

- **Behaviour.** Before marking, the panel records the next and previous items. When the live list reflects the change:
  - focus stays on the same item if it is still listed (All view);
  - otherwise it moves to the next item, then the previous one;
  - otherwise it moves to the empty-state message (`tabIndex=-1`).
- "Mark all as read" uses `aria-disabled` instead of `disabled`, so focus isn't dropped when nothing is unread. In the Unread view it moves focus to the empty state.
- Errors clear the pending focus and show a message.
- Escape behaviour is unchanged.
- **Browser results (worker3, 3 real notifications):**
  - All view: the item stayed focused and the bell read "2 unread".
  - Unread view: the middle item disappeared and focus moved to the next one; the last item disappeared and focus moved to "You're all caught up" inside the panel.
  - "Mark all" with nothing unread kept focus.
  - Escape closed the panel and returned focus to the bell.
  - The panel fits at 320 and 390 px (11–309 of 320).

  Activation used `.click()` and synthetic Escape; see the testing note.

### F3. QR download / print verification

- **Route.** `http://<origin>/dashboard/report?location=<locationId>`, built from the page origin and the location id only. No secrets or internal data. QR codes must be generated from the production site.
- **Download.** The link is a `data:image/png` with `download="qr-labs-physics-lab-204.png"`. The PNG signature and IHDR are valid; it is 512×512 px and 9.9 KB. The browser's QR was decoded module by module and compared with the `qrcode` library's matrix for the expected URL: 1,369 / 1,369 modules identical, so it encodes exactly that URL. The file was not saved to disk (no download triggered).
- **Print — bug found and fixed.** The print sheet was rendered inside the dialog. The dialog's animated panel became the containing block for `position: fixed`, so the printed sheet was confined to and clipped by the dialog box (375×534 px, QR shrunk to 312 px). The sheet is now portalled to `<body>`. With the print rules applied on screen, the sheet covers the full page (1366×768), the QR is exactly 10 cm (378 px), nothing else is visible, and the location text is readable. `window.print()` was called once (stubbed) and the sheet is removed on `afterprint`. The OS print dialog and a physical printout were NOT VERIFIED.
- **Scan flow (375 px):**
  - Signed out → `/login?next=/dashboard/report?location=…`.
  - Sign in → report form with "Physics Lab, Laboratory Complex, Floor 2, Room 204 · From the QR code you scanned".
  - Already signed in → prefilled (Reading Room).
  - Unknown id → "QR location not recognised".
  - Authentication is still required before submitting.
- A real phone camera scan was NOT VERIFIED.

### F4. Phone-size checks

320×568, 375×667 and 390×844 were checked on every Viewer page, the landing page, the worker dashboard, the notification panel, the QR entry and login flow, and the claim dialog. Genuine issues found and fixed:
- Viewer header: the Logo's own `inline-flex` beat `hidden`, so it showed at 320 px. Fixed with `max-[399px]:hidden`; the menu button is pinned to 36 px.
- Chart data tables: `sr-only` on a `<table>` still widened the page. Moved to a wrapper.
- Viewer issue rows in narrow cards overflowed at 1024 px. Fixed with a container query (`@md`).

### Viewer Mode — architecture

- **Routes (public, statically prerendered).** `/viewer` (overview), `/viewer/student`, `/viewer/worker`, `/viewer/admin`, `/viewer/map`, `/viewer/analytics`, `/viewer/how-it-works`. The landing page has "Explore as Viewer" (tertiary action, after Sign in / Create account) and a header link.
- **Shell (`components/viewer/ViewerShell.tsx`).** Separate from the authenticated `AppShell`:
  - an always-visible "Viewer mode" badge;
  - a Student / Worker / Admin switcher (client-side links with `aria-current`, no reload — verified);
  - Guide, theme toggle and Exit Viewer (→ `/`);
  - public-only navigation (Overview, Student, Worker, Admin, Campus map, Analytics, How it works); mobile drawer.
  - No account menu, notifications, search, payments, worker access or settings.
- **Data.** `lib/viewer/demoData.ts` is a static, synthetic dataset:
  - 24 issues on the schematic campus;
  - anonymous "Technician A/B/C";
  - 9 sample ratings and 5 sample claims;
  - a sample budget.

  It contains no names, emails, phone numbers, account ids, photos, receipts or private comments. Times are offsets from page load, so deadline states stay meaningful. Every figure is computed in `lib/viewer/demoStats.ts` with the real analytics, SLA, incident and insight functions, and is labelled as sample data.
- **Sample issue detail.** Title, category, priority, location, status, deadline, timeline (derived from the issue's own fields), incident link, resolution summary, claim and feedback. No reporter or worker identity.
- **Protected actions** (Report, Rate, Start work, Resolve, Claim, Assign, Escalate, Review/Pay, Export) open "Sign in to use this feature … nothing was changed", with a link to `/login`. No success toast is shown.
- **Accessibility.**
  - Semantic headings; tablist / tabpanel wiring.
  - Charts are hidden from assistive tech and paired with screen-reader data tables.
  - The map has a text table.
  - Share bars always print their numbers, and perspective links carry icons and labels, so colour is never the only cue.
  - Dark theme, reduced motion via the global rule.

### Viewer Mode — security model

- The Viewer reads and writes nothing in Firestore. The network log for the entire Viewer session showed zero Firestore (`:8080`) requests. The only Firebase traffic was the auth provider failing to refresh a stale emulator session (400), which is unrelated to the Viewer.
- **No new collections and no rules change for the Viewer.** A rules scan finds no `if true`, no `request.auth == null` allowance, and every read requires a signed-in user or an admin.
- There is no role or permission state in the Viewer, and no `isAdmin` / `role = admin`. A unit test scans all Viewer sources and fails if they import the Firebase SDK, data layer, auth context, role state or live-data hooks, or use browser storage other than the guide key.
- **Signed-out route checks** (real navigation, after planting `role=admin`, `isAdmin=true` and similar keys in local and session storage): `/admin`, `/admin/finance`, `/worker`, `/dashboard`, `/issues/<id>` and `/search` all redirected to `/login?next=…`. The active role comes from the Firestore profile, not browser storage.
- **Rules tests, "public visitors (Viewer Mode)":** a signed-out client cannot read receipts, photos, events, chat, notifications, feedback, campus locations, settings, user lists or a `viewer_demo` path. It also cannot approve, assign, escalate, describe, upvote, delete, add funds, write ledger entries, settings, locations, feedback or demo data.

### Guide

- Four steps: Choose a dashboard → Explore the workflow → Try the tools → You're in Viewer Mode. Buttons are Skip, Back, Next and "Start exploring".
- Shown on the first visit and reopened with the Guide button.
- Closing it any way (finish, Skip, Escape, Close) stores `smart-campus-viewer-guide-seen` in `localStorage` (try/catch; the guide shows again if storage is blocked).
- **Browser results:**
  - It opened on the first visit with Next focused and stepped through 1→2→1→4 with the keyboard; Back disappearing keeps focus on Next.
  - Start exploring stored the key, and it did not reopen on reload.
  - The Guide button reopened it; real Tab presses stayed inside, and real Escape closed it with focus back on Guide.
  - Skip closed it immediately.
- Motion comes from the shared Dialog (respects reduced motion).

### Tests performed in this pass

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS |
| `next build` | PASS — 26 routes (7 new, statically prerendered) |
| Unit tests | **212 / 212** (9 files; +26: `claims.test.ts`, `viewer.test.ts`) |
| Firestore rules tests | **181 / 181** (+9: described claims, paid-claim rewrite, public visitors) |
| npm audit | 5 high, dev-only (unchanged `braces` chain); `--omit=dev`: 0 |
| Viewer responsive, 7 sizes | PASS — 8 pages × 7 sizes, `extra=0 clipped=0` (after the fixes in F4; fresh loads) |
| Landing page, 7 sizes | PASS |
| Viewer accessibility audit (light and dark) | PASS — 0 issues and 0 low-contrast on all 8 pages after fixing two duplicate control names |
| Viewer interactions | PASS — role switcher, guide, sample issue dialog (Escape returns focus), sign-in prompt, drawer, map keyboard selection, Exit Viewer |
| Protected routes while signed out (incl. planted role keys) | PASS |
| Claim description end-to-end | PASS |
| Notification focus | PASS (activation via `.click()` / synthetic Escape) |
| QR download content / print layout / scan routes | PASS (no file saved; no OS print dialog) |
| Admin regression smoke (overview, analytics, workers, finance, locations, settings): load + audit | PASS |
| Automated end-to-end suite | NOT AVAILABLE — the repository has no automated E2E tests. Flows were exercised manually in the browser as listed |
| Console | One hydration warning seen once while the dev server hot-reloaded `ViewerShell`; not reproduced on fresh loads. Other errors were the stale-token 400 and the CSP blocking my own `fetch(data:)` test |

### Known limitations

- `claimDescription` is readable by any signed-in user, the same as `claimAmount` (issue documents are). Receipts remain private.
- `npm run test:rules` expects a global `firebase` CLI. In this environment the tests were run with `npx -y firebase-tools@latest emulators:exec …`.
- NOT VERIFIED in this environment:
  - **Live resizing of Viewer charts.** Recharts resizes through ResizeObserver, which didn't fire while the pane wasn't painting. Every fresh load at every size passed.
  - Real-keyboard Enter on the notification panel.
  - Screen readers.
  - A physical print, a saved PNG, and a phone camera scan.
- Viewer data is a fixed sample. It does not reflect real campus activity, by design.
- Rules, the index changes from earlier passes and this client are still undeployed. Deploy them together.
- Nothing has been committed, pushed or deployed.

```
FINAL FIXES & PUBLIC VIEWER MODE — STATUS

Claim description: persisted, rules-validated, immutable after filing, shown to admins and in payment history
Notification mark-read focus: fixed (stays in panel; next/previous item; empty state)
QR: download content verified (module-exact), print layout bug fixed, scan routes verified
Viewer Mode: /viewer + 6 sub-routes, public and read-only, static sample data, zero Firestore access
Guide: 4 steps, skippable, reopenable, localStorage only

Build: PASS · TypeScript: PASS · Lint: PASS
Unit: 212/212 · Rules: 181/181 · npm audit: prod 0 (dev 5 high, unchanged)

Firestore rules changed: claim description only (no public access added)
Deployed: NO · Committed / pushed: NO
```


---

## Final Viewer + UI/UX + Production Verification

Branch `feat/viewer-glass-ui`, built on the verified production release `9fb9989`. Every number below was produced in this pass; anything not run is listed under "Not verified".

### Viewer (public demo, no sign-in)

- **Routes (17):** `/viewer`, `/viewer/student`, `/viewer/worker`, `/viewer/admin`, `/viewer/issues`, `/viewer/issues/[id]`, `/viewer/report`, `/viewer/analytics`, `/viewer/map`, `/viewer/workers`, `/viewer/finance`, `/viewer/locations`, `/viewer/notifications`, `/viewer/search`, `/viewer/timeline`, `/viewer/settings`, `/viewer/how-it-works`. Each has a real URL; a deep link to a role-specific page switches to that perspective (`roleForPath`), and the perspective is remembered for the tab (`sessionStorage`).
- **Perspectives:** Student, Worker and Admin each have their own menu (the admin menu mirrors the signed-in admin menu), figures and actions. Switching is client-side (a marker set on `window` survived three switches).
- **Mock data (`lib/viewer/demoData.ts`):** generated with a fixed-seed generator, so it is identical on every visit: about 130 issues over 30 days, 26 locations, 12 workers, 54 students, claims, ratings, incidents, notifications and a timeline. Wording is campus-specific ("Projector not turning on in Room 104"). Tests forbid placeholder wording, emails, phone numbers, ids and links.
- **Figures are computed, not typed:** `demoStats.ts` runs the same analytics, SLA, incident, risk and insight functions as the admin pages. Tests check that every count adds up and that changing the deadline targets recalculates compliance.
- **Simulated actions (local state only):** submit a report (with validation, live category/priority suggestions and duplicate detection), assign a worker (ranked suggestions with reasons), start, resolve (validated), submit a claim (validated), approve and pay or reject a claim ("Demo payment: no real transaction"), rate a fix, upvote, change deadline targets, approve a worker request, mark notifications read, export CSV/JSON of demo data. Each shows a "Demo mode — no real data was modified" toast. A report created in the demo appeared in the student's list, the issues table, the admin totals (129 to 130; open 15 to 16) and the notifications.
- **Guided tour:** 24 steps, Back / Next / Skip / Close, progress bar and counter, spotlight on a real anchor, navigates and switches perspective first. Reopen with the Guide button. A unit test checks that every step's page exists and that its `data-tour` anchor is present in that page's source (or the shell). In the browser, all 24 steps were walked: every targeted step found and highlighted its anchor; the welcome and final steps are centred. On a phone the sidebar anchors are not visible, so the step is shown without a highlight rather than pointing at nothing. The welcome step stays on whatever page was opened, so deep links keep working.
- **Firebase isolation:** the Viewer lives outside the `(app)` route group, so Firebase Auth is never started there. The Viewer's first-load JavaScript is 131–147 kB (the signed-in pages are 237–376 kB). A unit test walks the whole import graph from every Viewer file (and the shared shell) and fails on any path to `firebase/*`, `lib/firebase`, `lib/firestore`, `useAuth` or `AuthProvider`; it also forbids `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and any storage use outside the preferences module.
- **Images:** generated inline SVG illustrations (per category) and a drawn sample receipt, so nothing is fetched and no private photo can appear. Because they are inline, there is no loading or failure state to show; every image has an `aria-label`/alt.

### UI/UX

- **Glassmorphism and depth:** tokens in `app/globals.css`: `.glass` (cards, no blur), `.glass-blur` (dialogs, menus, drawers, toasts, palette: blurred), `.glass-bar` (sidebar and top bar; blur on `::before` so fixed children are unaffected), `.depth-*` shadows, `.lift` hover elevation, a static ambient background, and a tilted 3D product preview on the landing page (disabled on small screens and with reduced motion). No continuous animation and no large blur layers. The helpers sit in `@layer components` so utility classes can override them (a bug found here: unlayered `position: relative` was overriding `fixed`/`sticky`).
- **Theme:** the indigo/violet palette replaces the blue, in separate light and dark token sets (not inverted). Both were checked on the landing page and the Viewer. Charts, map heat scale, tooltips and QR dialogs use the same tokens.
- **Shared shell:** `ShellFrame` is used by both the signed-in app and the Viewer: collapsible sidebar (icons plus tooltips, remembered), mobile drawer, glass top bar, skip link. `KpiCard` / `StatStrip` show animated counters (instant with reduced motion), trends and sparklines.
- **Filters, tables, search:** `FilterBar` (inline on desktop, bottom sheet on phones, removable chips, Clear all), sortable and paginated `IssueTable` (a list on phones), Ctrl/⌘ K palette (issues, pages, locations, workers, students, analytics sections).
- **Map:** the existing schematic map gained a layer switcher (issue density, all reports, active incidents, maintenance risk, SLA hotspots), category filter and a building detail panel.
- **Charts:** line/area, stacked bars, donut, horizontal bars, heat grid, with hidden data tables for screen readers. Charts now get an initial size, so the recharts "width(-1) and height(-1)" warning seen on production no longer appears.
- **Dialogs, toasts, states:** all dialogs share one component (focus trap, Escape, focus return); toasts gained a `demo` variant; skeletons, empty and error states are used throughout.
- **Landing page:** redesigned; "Explore as Viewer" is the primary call to action next to Sign in and Create account.

### Security

- `firestore.rules` and `firestore.indexes.json`: **unchanged** (no diff). Rules tests: **181 / 181** on the emulator.
- Signed-in app on the emulator: admin (8 pages), worker, student and the protected-route redirect still work; a student opening `/admin` is sent to `/dashboard`; a student's report was written to the emulator with its suggested category and priority.
- Viewer isolation: see above. The Viewer cannot reach roles, receipts, payments or any real record.

### Tests (actual results)

| Check | Result |
|---|---|
| Unit tests | PASS — **248 / 248** (9 files; 212 before, +36 for the Viewer: dataset, figures, feed, preferences, navigation, tour anchors, import-graph isolation) |
| Firestore rules tests | PASS — **181 / 181** |
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS (0 errors, 0 warnings) |
| `next build` | PASS — 36 routes |
| `npm audit --omit=dev` | 0 vulnerabilities (after a non-breaking `source-map-js` lockfile bump) |
| `npm audit` (all) | 5 high, dev-only: the unchanged `braces` chain through `eslint-config-next`; the fix is a breaking downgrade, so it was not applied |
| Viewer horizontal overflow, all 17 routes | PASS at 320, 375, 390, 412, 768, 1024, 1280, 1366, 1920 (dark) and 320, 768, 1366 (light). One real overflow was found and fixed (Finance grid) |
| Viewer accessibility heuristics (names, labels, alt, duplicate ids, headings, landmarks) | PASS after replacing skipped heading levels in issue rows |
| Keyboard | PASS — palette (Ctrl K, arrows, Enter, Escape, focus return), notification bell (Escape, focus return), mobile drawer (focus in, Escape, focus return) |
| Automated end-to-end suite | NOT AVAILABLE — the repository has none; flows were run by hand in the browser as listed |

### Not verified in this pass

- Production signed-in flows (student, worker, admin) and payments: need a person to sign in; the one real pending claim must not be paid.
- Physical QR scan with a phone; screen readers; a Tab-key sweep of the tour; 1440×900.
- Light-theme overflow at 375, 390, 412, 1024, 1280, 1920.
- Live chart resizing (the pane does not paint while hidden).


### Production verification (commit `688532c`, deployed to `https://smart-campus-issue-reporting-and-ma.vercel.app/`)

- **Deployment:** GitHub reports the Vercel project `smart-campus-issue-reporting-and-management-system` as **success** for `688532c`. The second, empty Vercel project `smart-campus-unifix` is still connected to the same repository and its build **fails** on every push; it serves nothing, but it puts a red check on each commit. Delete or disconnect it in the Vercel dashboard.
- **Routes:** all 17 Viewer routes, `/`, `/login`, `/register` and the protected routes return 200; an unknown path returns 404. Security headers (CSP with `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`, nosniff, referrer and permissions policies) are present.
- **Viewer in a fresh browser tab:** the first visit to a deep link (`/viewer/admin`) opened the tour on top of that page; all 24 steps ran, every targeted step highlighted its anchor, Finish stored the "seen" flag. Role switching did not reload the page. A demo report was submitted: it showed the validation errors, the suggested category and priority, the demo toast, and raised the admin totals (129 to 130). **Requests to any Firebase, Google API or localhost host: 0** (79 resources, all from the site's own origin, none failed). **Console: empty.**
- **Responsive on production:** no horizontal overflow on any Viewer route at 320 and 768 (dark) and 1366 (light).
- **Signed out:** the 16 direct Firestore REST checks (reads and forged writes) were all denied again after the deploy; `firestore.rules` was not changed or redeployed.
- **Requires manual production verification:** signing in as a student, worker and administrator on the live site, the signed-in flows, the payment flow and anything involving the one real pending claim. The signed-in app was exercised only on the local emulators (see above).


---

## Final Production Stabilization

Dated 2026-10-09. Status: **PRODUCTION VERIFIED WITH DOCUMENTED LIMITATIONS** (see "Not verified" below).

### Identities

| Item | Value |
|---|---|
| Production URL | `https://smart-campus-issue-reporting-and-ma.vercel.app/` |
| Serving Vercel project | `smart-campus-issue-reporting-and-management-system` (`prj_8fj3OyEv…`), alias confirmed on the deployment |
| Verified deployment | `dpl_4p4FtCG4…`, state READY, target production, built from `main` at `2e689f3` |
| Code under test | `2e689f3` (on top of `083e827` and `688532c`); branch `chore/production-stabilization`, fast-forwarded into `main` |
| Starting state | local `main` = GitHub `main` = `083e827`; production was serving `688532c`'s code |

### What the new tests found and fixed

1. **Firebase was loading inside the Viewer.** The Viewer's links to `/login` and `/` were prefetched, which pulled in the signed-in route group and initialised the Firebase SDK (IndexedDB `firebaseLocalStorageDb` and `firebase-heartbeat-database` appeared in a fresh browser). No network request was made, so the earlier "0 Firebase requests" check passed, but the isolation was weaker than claimed. Fixed with `prefetch={false}` on those links; the browser test now asserts that no IndexedDB database exists after browsing every Viewer route.
2. **Horizontal overflow on phones:** the landing page's glow layer (320–390 px); visually hidden text inside scroll containers (analytics heat grid, data tables) that widened the page at 320 px; the locations grid and segmented controls at 320 px.
3. **Accessibility (axe):** chart surfaces and donut slices were keyboard-focusable inside `aria-hidden` regions. Fixed in the Viewer and the signed-in admin charts (`accessibilityLayer={false}`, `rootTabIndex={-1}`).
4. Test-only corrections: selectors that matched legend icons, and measurements taken mid-animation. No test was removed or weakened.

### Test results (actual)

| Check | Result |
|---|---|
| Unit tests | PASS — 248 / 248 |
| Firestore rules tests (emulator) | PASS — 181 / 181 |
| TypeScript, ESLint, `next build` | PASS (0 errors, 0 warnings) |
| End-to-end (Playwright + Chromium), local production build | PASS — **87 / 87** |
| End-to-end against the live URL, after the deployment was READY | PASS — **87 / 87** |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` | 5 high, dev-only (`braces` chain via `eslint-config-next`); the fix is a breaking downgrade, not applied |

An earlier live run, started while the deployment was still building, showed 12 failures from a mixed old/new rollout (404 chunks); it passed after the deployment was READY.

### End-to-end coverage (`e2e/`, `npm run test:e2e`; `E2E_BASE_URL` targets any deployment)

- **Workflows (24 tests):** landing to Viewer; Student, Worker, Admin, Student without a reload; deep link, refresh and back/forward; unknown issue; tour first-visit, skip remembered, all 24 steps highlighting a visible element, Back, Guide restart, phone (no highlight on hidden anchors), keyboard (focus on Next, Tab and Shift+Tab stay inside, Enter, arrows, Escape, focus not lost); issue search, filter chips, sort, pagination; open an issue; simulated report with validation; assign, start, resolve; demo payment wording; analytics filters; charts keep their size through sidebar collapse, viewport changes, drawer, theme and navigation, with no Recharts warnings; theme toggle persisted; map layers and building detail; Ctrl K palette, notifications; QR dialog; reduced motion; mobile drawer; signed-out redirects.
- **Isolation:** browsing all Viewer routes and approving a demo payment makes no request outside the site, none to Firebase, Google APIs or localhost, logs nothing, stores only the known preference keys and creates no IndexedDB database.
- **Responsive matrix (60 tests):** 10 viewports (320×568, 375×667, 390×844, 412×915, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080) × 2 themes × {landing, login, register; all 17 Viewer routes; tour card and a dialog inside the viewport}. Each checks page overflow, elements sticking out of the viewport and the console.
- **Accessibility (3 tests):** axe-core WCAG 2.0/2.1 A and AA on the landing, login and all 17 Viewer routes in both themes, plus the tour card, a dialog and the search palette.

### Security regression

- `firestore.rules` and the indexes are unchanged; rules tests 181 / 181 (roles, worker approval, ownership, claims, payments, receipts, notifications, SLA settings).
- Signed out against production: the 16 direct Firestore reads and forged writes are all denied; response headers (CSP with `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`, nosniff, referrer and permissions policies) are present.
- Production data: 7 issues, 2 transactions and 1 admin document, as before. The pending ₹1,046 claim was not used, paid or modified.
- Signed-in UI on the local emulators was exercised in the previous pass (admin, worker, student, `/admin` blocked for a student). It was **not repeated** after this pass's CSS-only changes to shared tables, tabs and chart attributes.

### Obsolete Vercel project `smart-campus-unifix`

- Inspected via the Vercel API: it owns only its own `*.vercel.app` addresses (`smart-campus-unifix.vercel.app` and two generated ones), no custom domain, and both of its deployments (for `688532c` and `083e827`) are in state ERROR. The live domain belongs to the other project. It is connected to the same GitHub repository, which is why every push gets a failing check from it.
- Not changed. The available tools can't disconnect a Git integration, and a project must not be removed on its name alone. Manual steps: Vercel dashboard, project `smart-campus-unifix`, Settings, Git, Disconnect (reversible; leaves the project in place). Delete the project only after that if you no longer want it.
- Confirmed afterwards: the live project still deploys from `main` (`dpl_4p4FtCG4…`, source git, branch `main`).

### Firebase web API key

- The key found in history (`SETUP_COMPLETE.md` at `d08cc12` and earlier, and `lib/firebase.ts` at `5bf050b` and earlier) is a Firebase **browser** API key, not a secret: it is a different value from the key the live site uses (compared by hash only), and no service-account or private-key material exists anywhere in the history. At `HEAD`, only placeholders remain.
- No remediation was applied: restricting or deleting a key needs the Google Cloud console for the project that owns it, which this session cannot access, and a browser key is public by design. Recommended: in Google Cloud, APIs & Services, Credentials, open the old key and either delete it (the live site doesn't use it) or restrict it to your site's referrers and the Firebase APIs. Deleting it cannot affect production because production uses a different key. No history rewrite is needed.

### Not verified / remaining risks

- **Not verified:** signing in as student, worker and admin on the live site; the payment flow on production (no controlled test claim exists, so it must stay untested); a physical QR scan; screen readers (axe cannot judge wording or reading order); Safari and Firefox (Chromium only).
- **Failed:** nothing outstanding.
- **Open:** the red check from `smart-campus-unifix`; the old browser key; the dev-only audit findings.
