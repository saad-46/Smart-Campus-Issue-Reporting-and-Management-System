# Student profile (college, roll number, year, branch)

New student accounts give **college / institution**, **roll number**, **academic year** (1st to 5th) and **branch / department** when they register. Accounts created before this existed see an "Add your student details" card on their dashboard and can fill them in (or correct them later with **Edit**). A worker-access request does not collect them.

The four values live on the same `users/{uid}` document as the rest of the profile (flat fields `college`, `rollNumber`, `academicYear`, `branch`); there is no second profile store. They are shown only to the owner on the dashboard and are readable by administrators, exactly like the rest of the profile.

## Validation

Client (`lib/validation.ts`): trimmed, control characters removed, college 2 to 120 characters, roll number 2 to 30 characters (letters, digits and `- / . _` and spaces; stored upper-case), year one of the fixed list, branch 2 to 80 characters. The same limits are enforced by `firestore.rules`, so a modified client cannot store anything else.

## Rules change: deploy order matters

`firestore.rules` changed in this release (not yet deployed):

- A new profile may carry the four fields, **all or none**, each validated.
- The owner may set or correct them later, but only these four fields, together, and only on a plain (`role == 'user'`) account. Nothing else in the same write (role, name, earnings) is accepted. Workers, admins and other people cannot write them.
- Nothing about roles, worker requests or admin grants changed.

(That earlier rules change was backward compatible. The later registration change, see `docs/REGISTRATION_OTP.md`, is **not**: new profiles must carry proof of a verified contact, student details are mandatory, and the order of deployment there supersedes this section.) The new web app writes the fields at registration. Therefore:

1. Deploy the rules first (`firebase deploy --only firestore:rules`, after `npm run test:rules` passes; save the current ruleset as a rollback first, as in `docs/FIRESTORE_RULES_FIX.md`).
2. Then deploy the web app.

If the app were deployed first, new student registrations would be refused by the old rules until the rules are published.

Rules tests: `tests/rules/firestore.rules.test.ts`, "student profile fields" (creation, partial/mistyped/oversized values, owner completion, no smuggled fields, no one else, workers excluded, privacy).

## Sign-in role choice

`/sign-in` offers Student, Worker and Admin. It only decides which form is shown (`/login?role=…`). After the password is accepted, the sign-in page checks that the account really holds that role (the same `availableRoles` the rest of the app uses, derived from the profile and the `admins/` document); if it does not, the person is signed out again with an explanation. Access to `/admin` and `/worker` is still enforced by the guards and, independently, by the Firestore rules.

## Sign-out

Sign out ends the session and goes straight to the home page. The route guards are told the sign-out is deliberate, so they do not redirect to `/login?next=…` first. If Firebase refuses the sign-out, the person stays where they are and is told. Cached notification state is cleared so the next account in the same browser cannot see the previous one's.
