# 🏫 CampusIQ — Smart Campus Issue Reporting and Management System

> AI-powered campus issue reporting and management system built for the **DEV ARENA Hackathon** by GDG, UCE-OU.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-11-orange?logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)

---

## Team Details

- **Team Name: Solo Dev**
- **Team Lead: Saad Riyaz Mohammed**
- **Team Members:**
  - Member 1: Saad Riyaz Mohammed

---

## ✨ Features

- 🔐 **Authentication & roles** — Email/password login. Admins are granted in `admins/{uid}` (console only); worker access is approved by an admin.
- 🏷️ **Automatic categorisation (keyword-based)** — category, priority, a *heuristic* confidence, a one-line explanation, an extractive summary and the suggested team. No language model; staff can always change it, and a failure never blocks a report.
- 🔁 **Duplicate detection & incidents** — before submitting, similar open reports from the last 14 days are suggested; the reporter (or an admin) can link a report into an incident. Nothing is merged, hidden or deleted.
- 📍 **QR reporting** — admins create campus locations and print QR codes; scanning one opens the report form with the location filled in (after sign-in if needed).
- ⏱️ **SLA engine** — per-priority targets set by admins; on-track / approaching / breached / met / missed is *computed* from timestamps, never stored. Admins can escalate.
- 👷 **Assignment recommendations** — ranked by category experience, current workload and ratings. The admin decides.
- 🔔 **Notification centre** — bell with unread count, All/Unread, mark read / all read, open the related issue. Notifications carry no free text.
- 🕒 **Issue timeline** — real events written with each change (older issues show only their own timestamps, labelled).
- ⭐ **Resolution feedback** — the reporter rates a resolved issue once (rules-enforced); admins see aggregated satisfaction.
- 🗺️ **Campus map** — the real SUES campus at Mount Pleasant, Banjara Hills, Hyderabad, drawn from OpenStreetMap geometry (no map tiles, no API key, no network requests). Places are positioned from official geotagged photographs and each carries a source and a confidence level; issues are counted per place, with layers, search, filters and a list view. See [docs/SUES_CAMPUS_RESEARCH.md](docs/SUES_CAMPUS_RESEARCH.md).
- 📊 **Analytics** — ranges (Today, 7/30/90 days, semester, custom) and filters (category, building, status, priority, worker, department), charts, and CSV/JSON exports without reporter identities.
- 🧭 **Campus Operations overview** — KPIs from real data, SLA alerts, confirmed and suggested incidents, maintenance risk indicator (rule-based, with "not enough data" states), worker workload and factual insights.
- 🔎 **Search** — issue ID, title, location and category over a bounded projection of recent issues; also from anywhere with Ctrl/⌘K.
- 👀 **Viewer Mode** (`/viewer`) — the whole product as a public, no-sign-in demo: Student, Worker and Admin perspectives with their own menus, an issues table with filters, issue pages with deadlines, timeline and assignment suggestions, a report form with live suggestions and duplicate detection, analytics, a layered campus map, workers, finance, location QR codes, notifications, search (Ctrl/⌘ K), the campus timeline and settings, plus a 24-step guided tour. It runs on a generated sample campus (`lib/viewer/`, about 130 issues, 12 workers, 26 locations); actions are simulated in the browser and disappear when you leave. It never loads the Firebase SDK, so it cannot read or write campus records.
- 🖥️ **Interface** — one design system (semantic colour tokens, light and dark themes, reduced-motion support), role-based sidebar navigation, keyboard-accessible dialogs, menus and tabs, and layouts checked from 320 px phones to 1920 px desktops.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Backend | Firebase (Firestore + Auth), client-only — security is enforced by `firestore.rules` |
| Charts / QR | Recharts, `qrcode` (generated in the browser) |
| Language | TypeScript 5 |
| Tests | Vitest (unit), `@firebase/rules-unit-testing` on the Firestore emulator (rules) |
| "AI" | Deterministic keyword rules in `services/aiService.ts` and `lib/intelligence/*` |

---

## 📁 Project Structure (main folders)

```
app/
  page.tsx, login/, register/, switch-role/
  dashboard/            # student: My issues, Community, Report (+ report/ page with ?location= QR preset)
  worker/               # worker dashboard (SLA "needs attention", tasks, open pool, payouts)
  issues/[id]/          # issue detail: analysis, SLA, timeline, incident, feedback, admin controls, chat
  search/               # global search
  viewer/               # public Viewer Mode (outside the (app) route group, so no Firebase): overview, student/, worker/, admin/, issues/, report/, analytics/, map/, workers/, finance/, locations/, notifications/, search/, timeline/, settings/, how-it-works/
  admin/                # Overview, issues/, analytics/, map/, workers/, finance/ (budget, claims), locations/ (QR), settings/ (SLA targets)
components/
  ui/                   # design system: Button, Field (Input/Select/Textarea), Badge, Card, Dialog, Drawer, Menu, Tabs, Toast, States, Data
  shell/                # AppShell (sidebar, top bar, Ctrl/⌘K command palette), navigation, auth layout
  admin/, issue/, report/  # feature panels
hooks/                  # useAuth, useOverlay (focus trap/Escape), useChartTheme, useSlaConfig, useNotifications, useCampusLocations, useNow
lib/
  firestore.ts, finance.ts, feedback.ts, locations.ts, notifications.ts, timeline.ts
  firestoreRest.ts      # bounded REST queries with field projection (analytics, map, search)
  intelligence/         # similarity, sla, analytics, maintenance, assignment, insights, ranges
  campus.ts             # SUES campus model, read from data/campuses/sues-hyderabad/*.json
  viewer/               # Viewer Mode demo dataset, figures (computed with the real analytics), feed, navigation, tour steps, preferences
scripts/seed-emulator.mjs  # demo data for the LOCAL emulator only
tests/unit, tests/rules
```

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** 18+ installed ([download](https://nodejs.org))
- **Firebase project** created

### Step 1: Clone & Install

```bash
git clone <your-repo-url>
cd Smart-Campus-Issue-Reporting-and-Management-System
npm install
```

### Step 2: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Enable **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**
4. Enable **Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in **production mode** (locked), then deploy this repo's `firestore.rules` and `firestore.indexes.json` — never leave the database in test mode
5. Get your config:
   - Go to Project Settings → General → Your apps → Add Web App
   - Copy the config object values

### Step 3: Configure Environment

```bash
# Copy the example env file
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase config values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 4: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📍 Where things are

| | |
| --- | --- |
| Production | <https://smart-campus-unifix.vercel.app> (Vercel project `smart-campus-unifix`, Firebase project `campus-issue-rep-man-system`) |
| Legacy URL | `https://smart-campus-issue-reporting-and-ma.vercel.app` belonged to the project it replaced. It is not yet retired and may still serve the app; use the address above. |
| Repository | <https://github.com/saad-46/Smart-Campus-Issue-Reporting-and-Management-System> (`main`) |
| Local checkout | `D:\Projects\unifix\Smart-Campus-Issue-Reporting-and-Management-System` (the folder above it holds only backups and loose reference images, not application code) |

**Run:** `npm install`, then `npm run dev` (needs `.env.local`; see `.env.local.example`).
**Check:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rules` (needs Java 21+), `npm run build`, `npm run test:e2e` (after a build).
**Deploy:** Vercel builds every push to `main` from the Git integration. It needs the six `NEXT_PUBLIC_FIREBASE_*` variables listed in `.env.local.example`; there is no `vercel.json`.
**Documentation:** [docs/](docs/): campus research and on-site checklist, Explore parity, manual verification, Firestore rules notes, and [archived setup notes](docs/archive/).

---

## 👀 Explore Mode and the signed-in app

The same product runs in two data environments that are kept strictly apart:

| | Explore Mode (`/viewer`) | Signed-in app |
| --- | --- | --- |
| Sign-in | None | Required |
| Data | Fictional people and sample issues on the real SUES campus map | Your authorized records in Firestore |
| Actions | Simulated in the page's memory | Saved to Firestore, checked by the security rules |
| After a reload | Back to the same starting data | Still there |

- **Enter:** "Explore the Platform" on the landing page, or open `/viewer`.
- **Switch role:** "Explore as" Student / Worker / Admin. It picks a fictional account; it grants nothing real.
- **Try it:** report an issue (form, quick report, QR link or map), assign and escalate it as Admin, start and resolve it as Worker, claim and pay an expense, rate the fix, link reports into an incident, add a location, add funds, approve or remove a worker.
- **Reset:** "Reset demo" in the demo strip (it counts your simulated changes), or reload.
- **Real app:** "Sign in". Nothing done in Explore is carried over.

Explore never loads Firebase, and a demo record can never be written to Firestore; both are tested. The full feature-by-feature comparison, the architecture and the QR rules are in [docs/EXPLORE_PARITY.md](docs/EXPLORE_PARITY.md). Explore is a demonstration and not an official SUES system.

---

## 🧪 Testing and demo data (emulators only)

```bash
npm test             # unit tests (demo engine, isolation boundary, campus dataset, map labels, …)
npm run test:rules   # Firestore rules tests (needs Java 21+ for the emulator)
npm run test:e2e     # Playwright browser tests against a local production build (run `npm run build` first)
npm run typecheck && npm run lint && npm run build
```

`E2E_BASE_URL=https://… npm run test:e2e` runs the browser tests against a deployed site; they only read public pages and Explore Mode. What still needs a person (signed-in production flows, a QR scan on a real phone, the Vercel and Google Cloud dashboards) is in [docs/MANUAL_VERIFICATION.md](docs/MANUAL_VERIFICATION.md).

To try the app with demo data, run against the **local** Firebase Emulator Suite — never the real project:

1. Start the emulators: `npx firebase-tools emulators:start --only auth,firestore --project demo-unifix`
2. Seed: `npm run seed:emulator -- --issues=200 --reset` (refuses to run unless the target is a local emulator and the project id starts with `demo-`).
3. Create `.env.development.local` with `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-unifix` and placeholder values for the other `NEXT_PUBLIC_FIREBASE_*` keys, then `npm run dev`.

Demo accounts and their emulator-only password are listed at the top of `scripts/seed-emulator.mjs`.

---

## 📋 Firestore Security Rules

> Use the rules in [`firestore.rules`](./firestore.rules) — do not paste hand-written rules.
> Deploy them with `npx firebase-tools deploy --only firestore:rules`, or copy the file's
> contents into Firebase Console → Firestore → Rules. See
> [FIRESTORE_RULES_FIX.md](./docs/FIRESTORE_RULES_FIX.md) for the permission model and how to grant admin access.
>
> The notification centre needs one composite index (`notifications`: `recipientId` ↑, `createdAt` ↓), defined in
> [`firestore.indexes.json`](./firestore.indexes.json). Deploy it with
> `npx firebase-tools deploy --only firestore:indexes` before (or together with) the rules.

---

## 🧠 "AI" and intelligence features — what they really are

Everything is **deterministic and runs in the browser** — there is no language model and no server:

- **Categorisation** (`services/aiService.ts`): keyword matching. The "confidence" is a heuristic from how many keywords matched and how clearly one category won — not a probability. It is labelled that way in the UI.
- **Duplicates** (`lib/intelligence/similarity.ts`): word overlap with synonym folding, plus same building/room or same QR location.
- **Maintenance risk** (`lib/intelligence/maintenance.ts`): a transparent score from frequency, recurrence, recency and priority. Shown only with at least 10 issues and 14 days of history.
- **Recommendations / insights**: computed from recorded issues and ratings only.

All outputs are untrusted suggestions: they can't change roles, approve workers or payments, or bypass the rules. To add a real model later, call it from a server-side route (never ship an API key to the browser) and keep treating the result as a suggestion.

---

## 📋 Rules & Regulations

- Use of AI is permitted
- Use of open source libraries is permitted
- Plagiarism will lead to immediate disqualification
- The decision of the judges will be final

---

## 📝 License

Built for the DEV ARENA Hackathon by GDG, UCE-OU.

> Good luck to all participating teams! 🚀
