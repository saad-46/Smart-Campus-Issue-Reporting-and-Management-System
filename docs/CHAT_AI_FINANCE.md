# Issue chat, the quick-report assistant, and finance records

How the three features work, what each guarantees, and what is still needed outside the code. Verified results are in `SMART_CAMPUS_FINAL_AUDIT.md`.

## 1. Private issue chat

**Who can read and post** (`issues/{id}/messages`, enforced by `firestore.rules`):

| Person | Access |
| --- | --- |
| The reporter | Always |
| The worker the issue is assigned to **right now** | Yes |
| Any other worker, including one not yet assigned | No (this was open to every worker before) |
| The previous worker after a reassignment | No, from the moment the assignment changes. The reporter and the new worker see the whole history |
| Administrators | Read and post, as before: the existing oversight policy. They can never edit or delete a message |
| Signed-out visitors, Explore Mode | No. Explore has its own in-memory chat, with fictional messages |

A message carries `authorId`, `authorRole`, `authorName`, `text` and a server timestamp; the rules check the first three against the signed-in account and reject edits and deletes. Messages are plain text, 1 to 2000 characters. There are no attachments.

**Conversation summary** (`conversations/{issueId}`): one small document per issue, created with the first message sent after the issue has a worker. It holds the two participants (copied from the issue, never chosen by the client), the time and sender of the last message, a 120-character preview and each participant's read marker. It exists so unread state is one bounded query (`participants array-contains <uid>`, at most 100) instead of reading messages. It is written in the same transaction as the message, so it cannot lag it, and `workerId` follows the current assignee.

**What the interface does**
- "Chat with worker" / "Chat with student" on the issue page jumps to the thread; it appears only for the two participants once an assignee exists.
- The thread shows the newest 50 messages and "Load earlier messages" raises the bound in steps of 50, to 500. The listener is never unbounded.
- A "New message" badge appears on the student's and worker's issue lists until the conversation is opened; opening it (and each new message while open) marks it read.
- Sending runs in a transaction, so the text box is cleared only after the server has the message; the failure and retry states are shown.

**Not built, and not claimed**
- Background or push notifications. Unread state is in-app only.
- A chat notification in the notification centre; its notification types are fixed by the rules and carry no free text.
- Read receipts per message; there is one marker per participant.
- Two messages sent from two tabs at once can both be stored; messages are never merged or deduplicated.
- The summary's preview and last-message time are written by the sending participant; the rules check who and when, not that the preview matches a stored message. A participant can make a misleading preview or a false unread badge for the other participant of their own conversation. The messages themselves cannot be forged.

**Existing data.** Messages written before this change stay where they are and keep working. Issues that already have an assignee get a summary document the next time either participant sends a message; until then they show no unread badge.

## 2. Quick-report assistant

`components/ChatReporter.tsx` (Quick report on the report page) now holds a short conversation:

1. It asks what the problem is.
2. It asks only for what is missing: where it is, a little more detail, or which of two problems the report is about. At most two follow-ups; "Skip questions and review" is always there.
3. It warns about a possible hazard (fire, shock, gas, structural, someone hurt, flooding) and says to use the campus emergency process first. It is not an emergency channel.
4. It shows a draft that the student can edit completely: title, description, location, category, priority. It says whether the suggestion came from the rules or from a model, how confident it is, and why.
5. Nothing is created until the student presses **Submit issue**. The assistant has no ability to submit, assign, approve or change anything.

**Where the suggestion comes from**

| Layer | What it does | Where it runs |
| --- | --- | --- |
| Rules engine (`lib/reportAssistant.ts`) | Keyword classification, location, safety flags, questions. Deterministic | Browser and server |
| Model (optional) | Proposes title, category, priority, questions, flags | Server only: `POST /api/report-assist` |
| Output guard (`validateModelDraft`) | Keeps only schema-valid values | Server |

If no model is configured, or the provider is slow, rate limited, down or returns something malformed, the rules answer is used and the interface says which. The normal full form is never affected.

**What a model cannot do** (tested in `tests/unit/reportAssistant.test.ts` and `reportAssistRoute.test.ts`)
- The report description is always the student's own words. A model cannot rewrite it.
- It cannot introduce a location the student did not state (or a QR code did not carry).
- It cannot lower the priority of a hazard the rules found, or remove a safety flag.
- Categories and priorities outside the application's lists are dropped; unknown fields are ignored; links and over-long strings are removed.
- It has no tools and no Firestore access. The student's text is passed as delimited data and never as instructions; text such as "ignore previous instructions" is either refused or treated as part of a report.

**Configuration (server environment only; never `NEXT_PUBLIC_*`)**

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Enables the model layer. Without it the assistant runs on rules only | unset |
| `REPORT_ASSIST_MODEL` | Model id | `claude-haiku-5-5` |

`NEXT_PUBLIC_FIREBASE_API_KEY` (already required) is also read by the route, to ask Firebase Auth whether the caller's ID token is valid.

**Cost and limits.** A call is one short request (a few hundred input tokens, 400 output tokens at most). The route allows 12 requests per signed-in user per minute per server instance, 6 messages of 1000 characters, and an 8 KB body; abusive or empty input costs no provider call. The per-instance limiter is best-effort on serverless hosting: set a monthly spend limit on the provider key as the real ceiling. Check the provider's current pricing before enabling.

**Privacy.** Only the student's own messages (and, when scanned, the QR location name) are sent to the provider. No name, e-mail, uid, token or financial data is sent, and the route does not log message text. The conversation is not stored: it lives in the page until the report is submitted or the page is closed.

**Not done.** Photos are not attached from Quick report; use the full form. Explore Mode's quick report still uses the older single-message parser.

## 3. Finance: ledger, payments and balances

**What the numbers mean**

| Figure | Definition |
| --- | --- |
| Total funds | `finance/budget.totalAvailable`: opening balance plus every funds-added entry |
| Funds added (ledger) | Sum of `ledger` entries. The opening balance is shown separately and is not itemised |
| Payments recorded | Sum of `transactions` that are posted (`approved`) |
| Available | Total funds - budget `totalSpent` |
| After pending claims | Available - claims awaiting review. Negative is shown as a shortfall |
| Ledger check | Budget `totalSpent` equals the sum of recorded payments; a mismatch is flagged in red |

There is **no reservation**: a pending claim does not reduce Available. It is shown beside it so a shortfall is visible before paying. A rejected claim creates no entry and no expenditure. Posted entries are never edited or deleted.

**UniFix does not move money.** There is no payment gateway, bank connection or webhook, and nothing here can confirm a payment with a bank. So:
- **Add funds** is labelled as the administrator's record of an allocation. It writes an immutable `ledger` entry (amount, source, reason, date, optional reference, who recorded it) in the same commit that raises the budget by exactly that amount; the rules reject one without the other. A third document, `ledgerHead/state`, is written in the same commit (see "Funds ledger schema" below). The rules accept an entry only together with the head that names it, so one budget increase can never be counted by two entries. The budget document itself keeps its original three fields.
- **Record payment** (formerly "Pay") states how the claim was paid outside UniFix: method, date, and a reference number where the method leaves one (bank transfer, UPI, cheque). The entry is stamped `verification: "manual"` and `recordedBy`. It is shown as "recorded by an administrator, not confirmed by a bank".
- Recording is exactly-once: the claim must still be pending inside the transaction, the ledger entry must match the claim's amount and payee, and the budget, the worker's earnings and the entry change together. Two administrators acting at once cannot pay one claim twice.

The status words for claims stay `pending`, `approved`, `rejected`. "Approved" means "paid and recorded" in the existing model; a separate "approved, payment pending" state was not added, because it would need a second administrator step with no external system to confirm it.

**Funds ledger schema**

| Document | Fields | Written by |
| --- | --- | --- |
| `finance/budget` | `totalAvailable`, `totalSpent`, `updatedAt` (unchanged; the rules allow no others) | Add funds (raises `totalAvailable`), Record payment (raises `totalSpent`) |
| `ledger/{entryId}` | `type: "funds_added"`, `amount`, `source`, `reference?`, `description`, `receivedOn`, `createdBy`, `createdAt` | Add funds; immutable |
| `ledgerHead/state` | `lastEntryId`, `entryCount`, `updatedAt` | Add funds, same commit as the entry |

Rules for the head (`firestore.rules`, `match /ledgerHead/{docId}`):
- Administrators only, document id `state` only, never deleted.
- Created with `entryCount == 1`; every later write raises it by exactly one.
- `lastEntryId` must name an entry that this same commit creates and that does not yet exist, so a head can neither be written alone nor point at an old entry.
- The ledger entry rule requires `getAfter(ledgerHead/state).lastEntryId == entryId` and a budget raise equal to the entry's amount with `totalSpent` unchanged.

Behaviour of `addFundsToBudget` (`lib/finance.ts`):
- One transaction reads budget, head and entry, then writes all three. A concurrent addition makes it retry with the fresh counter; two different additions at once both land (count 2).
- The entry id is created once per Add-funds dialog. If that entry already exists (a retry after a network error, a double click, a second tab) the transaction writes nothing. If two submissions of the same id race, the loser's commit is refused by the rules and the app then sees the entry and treats it as already recorded.
- If `ledgerHead/state` exists but its count is unreadable (below 1), Add funds refuses with a message instead of guessing. If the head is missing, the first addition creates it (count 1). A head that disagrees with the number of ledger entries is shown as a red notice on the Finance page ("The funds ledger and its counter disagree"); payments are not blocked by it.
- Payments do not touch the ledger or the head. They stay exactly-once through the claim's `pending` status and the rules, as before.

**Compatibility.** The budget document is unchanged, so the previous application and the previous rules read and update it normally. Ledger entries and the head are new collections; before the first addition there is no head and nothing needs migrating. Payment entries written before this change have no method, reference or date and remain valid; they show "Not stated". The new fields are optional in the rules for that reason. No production document is migrated or rewritten.

**Exports.** "Export CSV" on the Finance page downloads funds and payments (type, recorded time, date stated, worker, description, method, reference, signed amount). It contains no receipt images, receipt links or reporter details.

**Workers** see their own payments with method, date and reference. They cannot create or change a payment, and they cannot read the ledger.

## 4. Firestore rules and indexes

Changed in `firestore.rules`:
- `issues/{id}/messages`: access narrowed to the reporter, the current assignee and administrators.
- New `conversations/{issueId}`: create, update (send and read marker) and read rules described above; no delete.
- New `ledger/{id}`: administrator create only, tied to the budget change and to `ledgerHead/state` in the same commit; no update, no delete.
- New `ledgerHead/state`: see "Funds ledger schema".
- `finance/budget`: **unchanged** (`totalAvailable`, `totalSpent`, `updatedAt` only).
- `transactions`: optional `method`, `reference`, `paidOn`, `verification`, `recordedBy`, validated when present.

No new composite index is needed (`firestore.indexes.json` is unchanged): the conversation list is a single `array-contains`, the ledger is ordered by one field.

**Deploying the rules is required before the app changes are used in production**, and the rules must go out together with the web app:

```bash
npx firebase-tools deploy --only firestore:rules --project campus-issue-rep-man-system
```

Nothing was deployed in this change.

### Rollback procedure (verified on the emulator)

Rules hashes, as the sha256 of `firestore.rules` with LF line endings, first 16 hex characters: previous production rules `014a9ad7ad8f3100` (commit `4de4e74`, kept as `tests/rules/fixtures/previous-release.rules`); this release's rules `30618e400fa3df24`.

To go back, restore the previous rules file and deploy it; do **not** edit any Firestore document:

```bash
git show 4de4e74:firestore.rules > firestore.rules   # or copy tests/rules/fixtures/previous-release.rules
npx firebase-tools deploy --only firestore:rules --project campus-issue-rep-man-system
```

What happens after the rollback, as exercised by `tests/rules/rollback.rules.test.ts` (data seeded as this release leaves it, run under the previous rules):
- The previous app can still add funds and pay claims: `finance/budget` has only its original fields, so its update rule accepts the write. (An earlier draft of this release stored a pointer on the budget; the old rules rejected every budget update after the first addition. That design was replaced, and a test pins the budget's keys.)
- A claim already paid under this release cannot be paid again; workers still read their own payments, including the new method/reference/date fields.
- Issue chat messages from the reporter, the assignee and administrators still work.
- `ledger`, `ledgerHead` and `conversations` are unknown to the previous rules and become unreadable and unwritable. Their documents stay in place and become usable again when this release's rules are redeployed.
- Funds added while the previous app runs are budget increases without ledger entries. The Finance summary shows them as part of the opening balance; they are not itemised and the ledger counter is unaffected.

Roll back the **app** (Vercel promote/rollback of the previous deployment) at the same time: this release's app calls collections the previous rules deny.

### Deployment order

1. Deploy this release's rules first. They are backward compatible with the previous app (verified by the existing rules tests for issues, users, transactions and budget).
2. Deploy the app.
3. Smoke test as an administrator: Add funds (one entry, one counter step), Finance page shows no red notice.

## 5. Tests

| Suite | What it covers |
| --- | --- |
| `tests/rules/firestore.rules.test.ts` | chat access by role, reassignment, spoofing; conversation summaries; ledger entries, head state and immutability; missing, skipped, replayed and malformed heads; concurrent and repeated additions in real transactions; additions alongside payments; payment details; exactly-once payment |
| `tests/rules/rollback.rules.test.ts` | the previous release's rules against data this release wrote: budget updates, payments, chat, and the new collections being closed |
| `tests/unit/reportAssistant.test.ts` | classification scenarios, location policy, safety, abuse and injection, model-output guard |
| `tests/unit/reportAssistRoute.test.ts` | authentication, provider and timeout fallbacks, rate and size limits, key never returned |
| `tests/unit/financeRules.test.ts` | summary definitions, reconciliation, payment and funds validation |
| `e2e/signed-in.emulator.spec.ts` | the whole flow on the local emulators: report, assign, chat, unread, resolve, claim, record payment, ledger, quick report |
