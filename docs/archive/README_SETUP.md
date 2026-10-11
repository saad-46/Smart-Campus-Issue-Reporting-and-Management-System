# 🚀 CampusIQ - Setup Instructions

## ⚡ Quick Start (3 Steps)

### 1️⃣ Install Node.js
```bash
# Download from: https://nodejs.org
# Install LTS version
# Verify:
node --version
npm --version
```

### 2️⃣ Set Up Firebase (5 minutes)
📖 **Follow:** `QUICK_FIREBASE_SETUP.md`

**Quick summary:**
1. Create Firebase project at https://console.firebase.google.com
2. Enable Email/Password authentication
3. Create Firestore database
4. Copy your Firebase config
5. Update `.env.local` with your config

### 3️⃣ Run the App
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
http://localhost:3000
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `QUICK_FIREBASE_SETUP.md` | ⚡ 5-minute Firebase setup guide |
| `FIREBASE_SETUP_CHECKLIST.md` | 📋 Detailed setup checklist |
| `SETUP_COMPLETE.md` | ✅ What was fixed & next steps |
| `.env.local.example` | 📝 Environment variables template |

---

## 🔧 What Was Fixed

### Firebase Configuration
- ✅ Enhanced validation for environment variables
- ✅ Detects placeholder values automatically
- ✅ Clear error messages with fix instructions
- ✅ Proper initialization with safety checks

### Error Handling
- ✅ Detailed console logging for debugging
- ✅ Specific Firebase error messages in UI
- ✅ Better error propagation through hooks
- ✅ User-friendly error display

### Code Quality
- ✅ Added comprehensive try-catch blocks
- ✅ Proper async/await error handling
- ✅ TypeScript type safety maintained
- ✅ Production-ready code structure

---

## 🎯 Current Status

### ✅ Completed
- [x] Firebase configuration validation
- [x] Enhanced error handling
- [x] Detailed logging system
- [x] Comprehensive documentation
- [x] User-friendly error messages
- [x] Setup guides created

### ⏳ Required (Your Action)
- [ ] Install Node.js (if not installed)
- [ ] Create Firebase project
- [ ] Update `.env.local` with real credentials
- [ ] Run `npm install`
- [ ] Run `npm run dev`

---

## 🔍 How to Verify Setup

### Check 1: Node.js Installed
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

### Check 2: Dependencies Installed
```bash
npm install
# Should complete without errors
```

### Check 3: Firebase Config Valid
```bash
npm run dev
# Console should show:
# ✅ Firebase configuration loaded successfully
# 📦 Project ID: your-project-id
# 🔥 Firebase initialized successfully
```

### Check 4: App Running
- Open: http://localhost:3000
- Should see CampusIQ landing page
- No console errors

### Check 5: Signup Works
- Go to: http://localhost:3000/register
- Create test account
- Should redirect to dashboard
- Check Firebase Console → Authentication → Users

---

## 🐛 Troubleshooting

### Error: "npm is not recognized"
```bash
# Install Node.js from https://nodejs.org
# Restart terminal after installation
```

### Error: "Firebase config is missing"
```bash
# 1. Update .env.local with real Firebase values
# 2. Restart dev server (Ctrl+C, then npm run dev)
```

### Error: "auth/operation-not-allowed"
```bash
# Enable Email/Password in Firebase Console:
# Authentication → Sign-in method → Email/Password → Enable
```

### Error: "permission-denied"
```bash
# Update Firestore security rules:
# Firestore → Rules → Copy rules from QUICK_FIREBASE_SETUP.md
```

---

## 📋 Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123
```

**Get these from:**
Firebase Console → ⚙️ → Project settings → Your apps → Web app config

---

## 🎨 Features

- 🔐 **Authentication** - Firebase Email/Password with role-based access
- 🧠 **AI-Powered** - Smart issue categorization
- 📊 **Real-Time** - Live updates with Firestore
- 🎨 **Modern UI** - Dark mode, glassmorphism, responsive
- 📱 **User Dashboard** - Report and track issues
- ⚡ **Admin Dashboard** - Manage all issues
- 🏷️ **Smart Categories** - 8 issue types
- 🎯 **Priority System** - High/Medium/Low

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **Backend:** Firebase (Firestore + Auth)
- **Language:** TypeScript 5
- **State:** React Hooks + Context API

---

## 📞 Support

If you encounter issues:

1. **Check console logs** - Detailed error messages
2. **Read documentation** - QUICK_FIREBASE_SETUP.md
3. **Verify .env.local** - No placeholder values
4. **Restart server** - After any .env.local changes

---

## 🎉 Ready to Build!

Once setup is complete:
1. ✅ Firebase configured
2. ✅ App running on localhost:3000
3. ✅ Signup/login working
4. ✅ No console errors

**Start building your hackathon project! 🚀**

---

## 📝 License

Built for the DEV ARENA Hackathon by GDG, UCE-OU.

> Good luck! 🎯
