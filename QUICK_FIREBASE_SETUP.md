# 🚀 Quick Firebase Setup Guide

## ⚡ 5-Minute Setup

### Step 1: Create Firebase Project (2 minutes)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click "Add project" or "Create a project"
   - Enter project name: `campus-iq-hackathon` (or any name)
   - Click "Continue"
   - Disable Google Analytics (optional for hackathon)
   - Click "Create project"
   - Wait for project creation (~30 seconds)
   - Click "Continue"

---

### Step 2: Get Firebase Config (1 minute)

1. **Add Web App**
   - In Firebase Console, click the **⚙️ gear icon** (top left)
   - Click "Project settings"
   - Scroll down to "Your apps" section
   - Click the **Web icon** `</>`
   - Enter app nickname: `CampusIQ Web`
   - **DO NOT** check "Firebase Hosting"
   - Click "Register app"

2. **Copy Configuration**
   - You'll see code like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "your-project-123.firebaseapp.com",
     projectId: "your-project-123",
     storageBucket: "your-project-123.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```
   - **Keep this tab open** - you'll need these values!

---

### Step 3: Enable Authentication (1 minute)

1. **Enable Email/Password Auth**
   - In Firebase Console sidebar, click "Build" → "Authentication"
   - Click "Get started" (if first time)
   - Go to "Sign-in method" tab
   - Find "Email/Password" in the list
   - Click on it
   - Toggle **Enable** switch ON
   - Click "Save"

✅ **Verify:** "Email/Password" should show status "Enabled"

---

### Step 4: Create Firestore Database (1 minute)

1. **Create Database**
   - In Firebase Console sidebar, click "Build" → "Firestore Database"
   - Click "Create database"
   - Select "Start in **test mode**" (for development)
   - Click "Next"
   - Choose location (select closest to you)
   - Click "Enable"
   - Wait ~30 seconds for database creation

2. **Set Security Rules**
   - Go to "Rules" tab
   - Replace with this:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       match /issues/{issueId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   - Click "Publish"

---

### Step 5: Update .env.local (1 minute)

1. **Open `.env.local` file** in your project root

2. **Replace the values** with your Firebase config from Step 2:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-123.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-123
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-123.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

⚠️ **IMPORTANT:**
- Copy values EXACTLY as shown in Firebase Console
- No quotes around values
- No spaces before/after `=`
- Save the file

3. **Restart Dev Server**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

---

## ✅ Verify Setup

After restarting, check your terminal/console:

**✅ Success - You should see:**
```
✅ Firebase configuration loaded successfully
📦 Project ID: your-project-123
🔥 Firebase initialized successfully
```

**❌ Error - You'll see:**
```
❌ FIREBASE CONFIGURATION ERROR
🚫 Missing environment variables or using placeholders
```

---

## 🧪 Test Signup

1. Go to: http://localhost:3000/register
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Password: test123
   - Role: User
3. Click "Create Account"
4. Should redirect to dashboard

**Check Firebase Console:**
- Go to Authentication → Users
- You should see your new user!

---

## 🐛 Troubleshooting

### Error: "Firebase config is missing"
**Fix:** Update `.env.local` with real values and restart server

### Error: "auth/operation-not-allowed"
**Fix:** Enable Email/Password in Firebase Console → Authentication → Sign-in method

### Error: "permission-denied"
**Fix:** Update Firestore security rules (see Step 4)

### Error: "auth/invalid-api-key"
**Fix:** Double-check API key in `.env.local` - copy it exactly from Firebase Console

### Changes not taking effect
**Fix:** Always restart dev server after changing `.env.local`

---

## 📋 Quick Reference

### Firebase Console URLs
- **Main Console:** https://console.firebase.google.com
- **Authentication:** Console → Build → Authentication
- **Firestore:** Console → Build → Firestore Database
- **Project Settings:** Console → ⚙️ gear icon

### Required Environment Variables
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

### Restart Command
```bash
npm run dev
```

---

## 🎯 Checklist

Before testing your app:

- [ ] Firebase project created
- [ ] Web app registered in Firebase
- [ ] Email/Password authentication enabled
- [ ] Firestore database created
- [ ] Firestore security rules updated
- [ ] `.env.local` updated with real values
- [ ] Dev server restarted
- [ ] No error messages in console

---

**You're all set! 🎉 Start building your hackathon project!**
