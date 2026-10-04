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
- 🗺️ **Campus map** — schematic heatmap of issues per building (layout grid, not GPS) with filters and a list view.
- 📊 **Analytics** — ranges (Today, 7/30/90 days, semester, custom) and filters (category, building, status, priority, worker, department), charts, and CSV/JSON exports without reporter identities.
- 🧭 **Campus Operations overview** — KPIs from real data, SLA alerts, confirmed and suggested incidents, maintenance risk indicator (rule-based, with "not enough data" states), worker workload and factual insights.
- 🔎 **Search** — issue ID, title, location and category over a bounded projection of recent issues; also from anywhere with Ctrl/⌘K.
- 👀 **Viewer Mode** (`/viewer`) — a public, read-only tour of the Student, Worker and Admin views, analytics, campus map and workflow, with a short first-visit guide. It uses a static, synthetic sample dataset (`lib/viewer/`) and never reads or writes Firestore; real actions show a "Sign in to use this feature" prompt.
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
  viewer/               # public read-only Viewer Mode: overview, student/, worker/, admin/, map/, analytics/, how-it-works/
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
  campus.ts             # schematic campus layout (edit to match your campus)
  viewer/               # Viewer Mode sample dataset, figures (computed with the real analytics), guide preference, navigation
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

## 🧪 Testing and demo data (emulators only)

```bash
npm test             # unit tests
npm run test:rules   # Firestore rules tests (needs Java 21+ for the emulator)
```

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
> [FIRESTORE_RULES_FIX.md](./FIRESTORE_RULES_FIX.md) for the permission model and how to grant admin access.
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
