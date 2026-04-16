# 🔥 Firebase Setup Checklist

## ✅ Complete This Checklist to Fix Signup Issues

### 1️⃣ Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name (e.g., "campus-iq-hackathon")
4. Disable Google Analytics (optional for hackathon)
5. Click **"Create project"**

---

### 2️⃣ Enable Email/Password Authentication

**⚠️ CRITICAL: This is the #1 reason signup fails!**

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **"Get started"** (if first time)
3. Go to **"Sign-in method"** tab
4. Find **"Email/Password"** in the list
5. Click on it
6. **Enable** the toggle switch
7. Click **"Save"**

✅ **Verify:** You should see "Email/Password" with status "Enabled"

---

### 3️⃣ Create Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development/hackathon)
4. Select a location (choose closest to you)
5. Click **"Enable"**

---

### 4️⃣ Configure Firestore Security Rules

1. In Firestore Database, go to **"Rules"** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to create and read issues
    match /issues/{issueId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

---

### 5️⃣ Get Firebase Configuration

1. In Firebase Console, click the **⚙️ gear icon** → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** `</>` to add a web app
4. Enter app nickname (e.g., "CampusIQ Web")
5. **DO NOT** check "Firebase Hosting" (not needed)
6. Click **"Register app"**
7. **Copy the config values** (you'll see something like this):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

---

### 6️⃣ Update .env.local File

1. Open `.env.local` in your project root
2. Replace the placeholder values with your actual Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

⚠️ **IMPORTANT:** 
- Remove quotes around values
- No spaces before or after `=`
- Save the file

---

### 7️⃣ Restart Development Server

**CRITICAL:** Next.js only reads `.env.local` on startup!

1. Stop the dev server (Ctrl+C)
2. Run: `npm run dev`
3. Check the console for Firebase config logs

---

## 🔍 Debugging Guide

### Check Browser Console

Open browser DevTools (F12) and look for these logs:

✅ **Good signs:**
```
🔥 Firebase Config Status: { hasApiKey: true, hasAuthDomain: true, ... }
🔐 Starting signup process...
✅ Firebase Auth user created: abc123...
✅ User profile saved to Firestore
🎉 Signup completed successfully!
```

❌ **Bad signs:**
```
❌ Firebase config is missing or using placeholder values!
❌ Signup failed: FirebaseError: Firebase: Error (auth/operation-not-allowed)
```

---

## 🐛 Common Errors & Solutions

### Error: "auth/operation-not-allowed"
**Cause:** Email/Password authentication not enabled  
**Fix:** Go to Firebase Console → Authentication → Sign-in method → Enable Email/Password

### Error: "auth/invalid-api-key"
**Cause:** Wrong API key in .env.local  
**Fix:** Double-check your Firebase config values

### Error: "auth/network-request-failed"
**Cause:** No internet or Firebase is blocked  
**Fix:** Check internet connection, disable VPN if active

### Error: "permission-denied" (Firestore)
**Cause:** Firestore security rules too restrictive  
**Fix:** Update rules to allow authenticated users (see step 4)

### Error: "Failed to create account" (generic)
**Cause:** Multiple possible issues  
**Fix:** 
1. Check browser console for detailed error
2. Verify all steps above
3. Restart dev server after changing .env.local

---

## ✅ Final Verification

Before testing signup:

- [ ] Firebase project created
- [ ] Email/Password auth **ENABLED** in Firebase Console
- [ ] Firestore database created
- [ ] Firestore security rules updated
- [ ] `.env.local` file updated with real values
- [ ] Development server restarted
- [ ] Browser console open to see logs

---

## 🎯 Test Signup Flow

1. Go to `http://localhost:3000/register`
2. Fill in the form:
   - Full Name: Test User
   - Email: test@example.com
   - Password: test123 (min 6 chars)
   - Role: User or Admin
3. Click "Create Account"
4. Watch browser console for logs
5. Should redirect to dashboard on success

---

## 📞 Still Having Issues?

Check these in order:

1. **Browser Console** - Look for red error messages
2. **Firebase Console** - Check Authentication tab for new users
3. **Network Tab** - Check if requests to Firebase are failing
4. **`.env.local`** - Verify no typos in config values
5. **Restart** - Stop and restart the dev server

---

## 🚀 Production Checklist

Before deploying:

- [ ] Change Firestore rules from "test mode" to production rules
- [ ] Add proper email validation
- [ ] Set up password reset flow
- [ ] Add rate limiting for signup
- [ ] Enable Firebase App Check (optional)
- [ ] Set up proper error monitoring

---

**Good luck with your hackathon! 🎉**
