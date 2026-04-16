# 🏫 CampusIQ — Smart Campus Issue Reporting and Management System

> AI-powered campus issue reporting and management system built for the **DEV ARENA Hackathon** by GDG, UCE-OU.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-11-orange?logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)

---

## Team Details

- **Team Name:**
- **Team Lead:**
- **Team Members:**
  - Member 1:
  - Member 2:
  - Member 3:
  - Member 4:

---

## ✨ Features

- 🔐 **Authentication** — Firebase Email/Password login with role-based access (User & Admin)
- 🧠 **AI-Powered Analysis** — Automatic issue categorization and priority assignment
- 📊 **Real-Time Updates** — Live Firestore listeners for instant status changes
- 🎨 **Modern UI** — Dark mode, glassmorphism, gradient accents, fully responsive
- 📱 **User Dashboard** — Report issues, track status, view history
- ⚡ **Admin Dashboard** — Manage all issues, filter by status/priority, assign & resolve
- 🏷️ **Smart Categorization** — 8 categories (Electrical, Plumbing, Infrastructure, etc.)
- 🎯 **Priority Color Coding** — 🔴 High | 🟡 Medium | 🟢 Low

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS 4 |
| Backend | Firebase (Firestore + Auth) |
| Language | TypeScript 5 |
| State | React Hooks (Context API) |
| AI | Placeholder service (modular, ready for OpenAI/Claude) |

---

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout with AuthProvider
│   ├── globals.css         # Global styles + Tailwind
│   ├── login/page.tsx      # Login page
│   ├── register/page.tsx   # Registration page
│   ├── dashboard/          # User dashboard
│   │   ├── layout.tsx
│   │   ├── page.tsx        # My Issues list
│   │   └── report/page.tsx # Report new issue
│   └── admin/              # Admin dashboard
│       ├── layout.tsx
│       └── page.tsx        # Manage all issues
├── components/             # Reusable UI components
│   ├── AuthProvider.tsx    # Auth context provider
│   ├── Navbar.tsx          # Navigation bar
│   ├── ProtectedRoute.tsx  # Route guard
│   ├── IssueCard.tsx       # Issue display card
│   ├── IssueForm.tsx       # Issue reporting form
│   └── ui/                 # Base UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Textarea.tsx
│       └── Modal.tsx
├── hooks/                  # Custom React hooks
│   └── useAuth.ts          # Firebase auth hook
├── lib/                    # Core utilities
│   ├── firebase.ts         # Firebase initialization
│   ├── auth.ts             # Auth helper functions
│   └── firestore.ts        # Firestore CRUD operations
├── services/               # External services
│   └── aiService.ts        # AI analysis (placeholder)
└── types/                  # TypeScript interfaces
    └── index.ts            # All type definitions
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
   - Start in **test mode** (for development)
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

## 📋 Firestore Security Rules (Recommended)

Add these rules in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile, admins can read all
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Issues: authenticated users can create, anyone can read
    match /issues/{issueId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

---

## 🧠 AI Service

The AI service (`services/aiService.ts`) uses keyword-based analysis to demo smart categorization. It supports 8 categories:

- Electrical, Plumbing, Infrastructure, Cleanliness
- Safety, IT, Furniture, Landscaping

**To connect a real AI API**, replace the `analyzeIssue()` function body with an API call to OpenAI or Claude.

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
