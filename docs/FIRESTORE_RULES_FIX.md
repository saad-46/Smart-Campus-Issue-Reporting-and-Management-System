# 🔒 Firestore Security Rules

The rules for this project live in [`firestore.rules`](../firestore.rules). They are the
application's backend: every permission is enforced there, not in the web client.

> ⚠️ Earlier versions of this file suggested pasting `allow read, write: if request.auth != null`
> into the console to make a "permission denied" error go away. **Do not do that** — it lets any
> signed-in user read, modify or delete everything, including making themselves an admin.

## Deploying

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project <your-project-id>
```

Or copy the contents of `firestore.rules` into Firebase Console → Firestore Database → Rules → Publish.

Deploy the rules and the web app together: the app writes server timestamps and field shapes that
the rules expect.

## Granting admin access

Nobody can become an admin from the app. To make an account an admin:

1. Firebase Console → Authentication → copy the user's **UID**.
2. Firebase Console → Firestore Database → create a document at **`admins/{UID}`**
   (any content, e.g. `grantedBy: "your name"`).
3. The user signs in again and can switch to Admin mode.

Delete the document to revoke access. The `admins` collection is not writable by any client.

**Do this before deploying the rules**, otherwise nobody will be able to open the admin dashboard.

## Roles

| Role | How it is granted | What it can do |
|---|---|---|
| user | Every signed-in account | Report issues (one per 30 s, database-enforced), read issues, upvote, chat on own issues, withdraw own open + unassigned issue, link own new report to an existing incident, rate own resolved issue once |
| worker | Requested at registration, granted only when an admin sets `users/{uid}.role = "worker"` | Claim open issues, move own tasks Open → In Progress → Resolved, submit an expense claim, see own payouts |
| admin | A document at `admins/{uid}` (console only) | Read everything, manage workflow fields (assign to approved workers, escalate, link incidents), approve/reject claims, manage the budget, change user roles, manage QR locations and SLA targets |

## Collections added for the intelligence features

| Path | Who can write | Who can read | Key constraints |
|---|---|---|---|
| `issues/{id}/events/{eventId}` | The actor, only in the same commit as the change it records (checked with `getAfter`) | Signed-in users | Immutable; type and `actorRole` validated; one-off events use fixed ids |
| `notifications/{id}` | The actor of a matching change in the same commit | Recipient only | No free text (message rendered from type + validated fields); recipient may set `readAt` once or delete |
| `feedback/{issueId}` | The issue's reporter, once, after it is Resolved | Author and admins | Integer rating 1–5, comment ≤ 500, `assignedTo`/`category` copied from the issue; no update/delete |
| `campusLocations/{id}` | Admins (create/delete) | Signed-in users | Slug ids, validated fields, no update |
| `config/sla` | Admins | Signed-in users | Integer hours 1–2160 per priority |

The notification listener needs the composite index in `firestore.indexes.json`.

## Testing the rules

```bash
npm run test:rules
```

Runs `tests/rules/*.rules.test.ts` (core hardening + the intelligence features) against the local Firestore emulator
(requires JDK 21+ and `firebase-tools`).

## Seeing "Missing or insufficient permissions"?

- You are signed out, or signed in as an account without the needed role.
- You are an admin in the UI but have no `admins/{uid}` document (see above).
- The deployed rules are older than the app. Redeploy `firestore.rules`.
