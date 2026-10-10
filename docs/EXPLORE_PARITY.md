# Explore Mode and the signed-in app

UniFix has two data environments for one product:

- **Explore Mode** (`/viewer`, no sign-in): fictional people and sample issues on the real SUES campus map. Every action is simulated in memory.
- **Signed-in app** (`/dashboard`, `/worker`, `/admin`, …): real accounts, real records in Firestore, permissions enforced by Firestore Security Rules.

They are kept strictly apart. Explore never loads Firebase; the signed-in app never uses the demo engine.

Explore Mode is a demonstration. It is not an official system of, or endorsed by, the Sultan-ul-Uloom Education Society.

## Using Explore Mode

| To | Do this |
| --- | --- |
| Enter | "Explore the Platform" on the landing page, or open `/viewer` |
| Switch role | "Explore as" Student / Worker / Admin under the header. It chooses which fictional account you act as; it grants nothing real |
| Try a workflow | Report an issue (form, quick report, QR link or map), assign it as Admin, start and resolve it as Worker, claim an expense, pay it as Admin, rate the fix as Student |
| See what changed | The "Reset demo" control in the demo strip counts your simulated changes |
| Start again | "Reset demo" (asks first if you have changes), or reload the page |
| Use the real app | "Sign in" in the sidebar or on the landing page |

**How long demo changes last.** They live in the page's memory only. Moving between Explore pages keeps them; a reload, closing the tab or "Reset demo" returns to the same deterministic baseline. Nothing is written to Firestore, and nothing about the demo data is written to browser storage (only three preferences are: tour seen, chosen perspective, theme).

## Architecture

```text
            Shared UI (components/ui, components/shell/ShellFrame,
            components/issue, components/admin/CampusMap, charts)
                                  |
            Shared rules and logic (no Firebase imports)
   lib/validation · lib/sharedRules · lib/constants (lifecycle, limits)
   lib/intelligence/* (analytics, SLA, similarity, assignment, risk)
   lib/campus (SUES dataset) · lib/mapLabels · services/aiService
                                  |
              +-------------------+-------------------+
              |                                       |
        Explore Mode                            Signed-in app
   app/viewer/* · components/viewer/*      app/(app)/* · AuthProvider
              |                                       |
   lib/viewer/demoStore.ts                 lib/firestore · lib/finance ·
   (pure reducer over in-memory state)     lib/locations · lib/feedback ·
              |                            lib/notifications · chatService
   lib/viewer/demoData.ts                             |
   (deterministic sample dataset)          Firestore + Security Rules
```

- **One demo engine.** `lib/viewer/demoStore.ts` holds the whole Explore "database" as one immutable value, and `applyDemoAction(state, action, role)` is the only way to change it. It is pure: no Firebase, no network, no storage.
- **Same rules.** The engine validates with the same functions as the real data layer (`parseAmount`, `validateChatMessage`, `validateClaimDescription`, `validateLocationInput`, `validateFeedbackInput`, `validateSlaHours`, `canTransition`) and applies the same role restrictions the Firestore rules enforce.
- **No fake success.** A refused action returns `{ ok: false, error }`, leaves the state untouched, and the page shows the reason.
- **Same figures.** Explore dashboards, analytics, the map, incidents and risk indicators are computed by the same `lib/intelligence` functions the admin pages use, from the demo state.
- **Pages.** Explore and signed-in pages are separate route files that share the components and logic above. They are not one set of pages with two back ends: the signed-in pages subscribe to live Firestore listeners and handle loading, offline and permission errors that have no demo equivalent. Merging them would put Firebase imports on the Explore route, which is exactly what the isolation tests forbid.

## Isolation: how it is enforced and tested

| Guarantee | Enforced by | Test |
| --- | --- | --- |
| Explore never imports Firebase, directly or transitively | Route group split (`app/viewer` vs `app/(app)`), import discipline | `tests/unit/viewer.test.ts` walks the import graph of every Explore file |
| The demo engine runs with Firebase unavailable | Pure module | `tests/unit/demoStore.test.ts` mocks `firebase/*` and `@/lib/firebase` to throw on import, then runs every workflow |
| Explore makes no request outside the site and none to Firebase | No network code | `e2e/viewer.spec.ts` (all routes) and `e2e/parity.spec.ts` (after every action) |
| Explore stores no demo data in the browser | In-memory state | `e2e/parity.spec.ts` "a reload returns to the same baseline" |
| A demo record can't be written to Firestore | `assertRealId` at the top of every signed-in write on an issue | `tests/unit/modeBoundary.test.ts` (10 write functions refuse a demo id before any Firestore call) |
| A failed real write is reported as a failure | Errors propagate; no fallback path exists | `tests/unit/modeBoundary.test.ts` |
| The role switch grants no real privilege | Real roles come from Firestore (`admins/{uid}`, approved worker) and the rules | `tests/rules/*` (181 tests); emulator check: a student who picks the demo Admin perspective is still redirected from `/admin` and `/worker` |
| Explore shows no real record, even to a signed-in visitor | Demo dataset only | Emulator check: signed in as admin, Explore lists only `SC-…` issues and makes no Firestore or Auth request |

Demo ids are recognisable on sight: issues are `SC-<number>`, ledger entries `TX-<number>`, everything created during a visit starts with `demo-`. Firestore ids never have these shapes.

## Feature parity

"Same" means the same control, wording and rule. Data and persistence always differ as described above.

### Routes

| Signed-in | Explore | Notes |
| --- | --- | --- |
| `/` landing | `/` landing | Shared |
| `/login`, `/register` | Role switch | No credentials in Explore. Registration, e-mail verification and password reset are not simulated |
| `/switch-role` | "Explore as" switch | |
| `/dashboard` (student) | `/viewer/student` | Same |
| `/dashboard/report` | `/viewer/report` | Full form and quick report in both |
| `/issues/[id]` | `/viewer/issues/[id]` | Same panels |
| `/worker` | `/viewer/worker` | Same |
| `/admin` | `/viewer/admin` | Same |
| `/admin/issues` | `/viewer/issues` | Same filters, sort, export |
| `/admin/analytics` | `/viewer/analytics` | Same filters and exports; see date ranges below |
| `/admin/map` | `/viewer/map` | Same map component and dataset |
| `/admin/workers` | `/viewer/workers` | Same |
| `/admin/finance` | `/viewer/finance` | Same |
| `/admin/locations` | `/viewer/locations` | Same |
| `/admin/settings` | `/viewer/settings` | Same |
| `/search`, header search | `/viewer/search`, header search | Same |
| Notification bell | Bell and `/viewer/notifications` | Same |
| — | `/viewer/timeline`, `/viewer/how-it-works`, guided tour | Explore only |

### Actions

| Action | Who | Signed-in | Explore | Covered by |
| --- | --- | --- | --- | --- |
| Report an issue (full form) | Anyone | `createIssue` | `createIssue` | unit, e2e |
| Quick report (one message, parsed, reviewed) | Anyone | `ChatReporter` | Quick report | e2e |
| Report from a QR link; unknown id refused | Anyone | Location looked up in Firestore | Location looked up in the demo list | unit, e2e |
| Pick the place on the map | Anyone | Campus place list | List and map picker | e2e |
| Duplicate suggestions before submitting | Anyone | Same function | Same function | unit |
| Upvote / remove upvote | Student | `toggleUpvote` | `toggleUpvote` | unit, e2e |
| Rate a fix once | Reporter | `submitFeedback` | `rate` | unit, e2e |
| Discussion on an issue (private to reporter and staff) | Reporter, staff | `sendChatMessage` | `postMessage` | unit, e2e, emulator |
| Take a task from the open pool | Worker | `assignIssue` | `assign` (self only) | unit |
| Start work, mark resolved | Assigned worker | `updateIssueStatus` | `start`, `resolve` | unit, e2e |
| Repair tip on a task | Worker | Shared `RepairTip` | Shared `RepairTip` | e2e, emulator |
| Submit an expense claim | Assigned worker | `submitBill` (with the resolution, receipt photo) | `submitClaim` (after resolving, generated receipt) | unit, e2e |
| Assign / reassign with ranked suggestions | Admin | `adminAssignIssue` | `assign` | unit, e2e |
| Unassign | Admin | `adminAssignIssue("")` | `unassign` | unit, e2e |
| Escalate / clear | Admin | `setIssueEscalation` | `setEscalation` | unit, e2e, emulator |
| Link to / remove from an incident | Admin | `linkIssueToIncident` | `link`, `unlink` | unit, e2e |
| Group suggested reports as one incident | Admin | Admin dashboard | Admin dashboard | unit |
| Approve and pay, or reject, a claim, once | Admin | `approveClaim`, `rejectReceipt` | `decideClaim` | unit, e2e |
| Add funds to the budget | Admin | `addFundsToBudget` | `addFunds` | unit, e2e |
| Approve / reject a worker request | Admin | `setWorkerAccess` | `decideWorkerRequest` | unit, e2e |
| Remove worker access (assignments stay) | Admin | `setWorkerAccess("revoke")` | `removeWorker` | unit, e2e |
| Add a location with a QR code | Admin | `createCampusLocation` | `addLocation` | unit, e2e |
| Delete a location | Admin | `deleteCampusLocation` | `deleteLocation` (added ones) | unit, e2e |
| Print, download, copy a QR code | Admin | Same dialog | Same dialog | e2e |
| Change deadline targets | Admin | `saveSlaConfig` | `saveSla` | unit, e2e |
| Notifications: open, mark read, mark all read | Anyone | Same | Same | unit, e2e |
| Analytics filters: range, category, department, place, status, priority, worker | Admin | Same | Same | e2e |
| Issue filters: status, priority, category, place, assignment | Admin | Same | Same, plus deadline state | e2e |
| CSV / JSON export without reporter identities | Admin | Authorized real data | Demo data | e2e |
| Map: layers, search, filters, zoom, pan, reset, keyboard, place detail | Admin | Same component | Same component, plus feature layers and search | unit, e2e |
| Theme, sidebar, search palette, responsive layout | Anyone | Same shell | Same shell | e2e |

### Deliberate differences

| Area | Difference | Why |
| --- | --- | --- |
| Accounts | No registration, verification, password reset or sign-out in Explore | Explore has no accounts; the role switch replaces them |
| Photos | Signed-in uploads up to three photos and can draw on them. Explore attaches a generated sample image | No visitor file is read, stored or shown in a public demo |
| Receipts | Signed-in claims carry a private receipt photo. Explore shows a generated receipt | No real receipt is ever exposed |
| Claim timing | Signed-in: the claim is submitted with the resolution. Explore: resolve first, then claim | Lets a visitor see each step separately |
| Date ranges | Signed-in analytics: today, 7/30/90 days, semester, custom. Explore: 7, 14, 30 days | The sample dataset covers 30 days |
| Locations | Explore can delete only locations added during the visit | The researched campus dataset is fixed in both modes |
| Marking a notification unread | Not offered in either mode | The Firestore rules let a recipient mark a notification read once and never unread, so the Explore page matches that |
| Deleting an issue | Not offered in either mode | No screen uses it |
| Removing the Worker persona | Refused in Explore | The Worker perspective would have no account to show |
| Recording a payment, adding funds | Explore's dialogs do not ask for method, reference or date, and it has no funds ledger or reconciliation card | Added to the signed-in Finance page afterwards (docs/CHAT_AI_FINANCE.md); the demo still simulates "approve and pay" and "add funds" |
| Chat | Explore keeps its in-memory discussion and has no unread badge, "Load earlier" or assignee-only rule | The real chat's access rules are enforced by Firestore, which Explore never contacts |
| Quick report | Explore uses the single-message parser; the signed-in assistant asks follow-up questions and may use a server-side model | The assistant needs a signed-in session and the server endpoint, neither of which Explore has |

## QR codes

- A QR code carries one thing: a location id in a link (`/dashboard/report?location=<id>` when signed in, `/viewer/report?location=<id>` in Explore). No user data, no secret.
- The id is untrusted input. It must match `^[a-z0-9-]{1,60}$` and name a known location (Firestore `campusLocations` when signed in, the demo list in Explore). Anything else shows "That QR code isn't recognised" and leaves the location empty.
- The location shown after scanning is the one submitted: the form field is filled from the resolved location, and the stored issue keeps its id.
- A location's confidence travels with it: the report form shows "Approximate position", "Sources disagree" or "Unverified", and says when a place has no known position and won't appear on the map.
- A location added in Explore exists only in that tab, so its QR code works there only. The dialog says so and offers "Open the report form as a scan would".
- Physical scanning with a phone camera has not been tested by automation. See [MANUAL_VERIFICATION.md](MANUAL_VERIFICATION.md).
