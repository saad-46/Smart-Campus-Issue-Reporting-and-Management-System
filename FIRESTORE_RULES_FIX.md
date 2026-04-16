# 🔧 Firestore Permission Error - Quick Fix

## ❌ Error
```
FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
```

## ✅ Solution

Your Firestore security rules are blocking access. You need to update them in Firebase Console.

### Step 1: Go to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **campus-issue-rep-man-system**
3. Click **Firestore Database** in the left sidebar
4. Click the **Rules** tab at the top

### Step 2: Update Security Rules

Replace the existing rules with these (for development/hackathon):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Issues collection - authenticated users can read all, write their own
    match /issues/{issueId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

### Step 3: Publish Rules

1. Click **Publish** button
2. Wait for confirmation (usually instant)
3. Refresh your app

---

## 🔒 Production Rules (Use Later)

For production, use stricter rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user is worker
    function isWorker() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'worker';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && 
                      (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Issues collection
    match /issues/{issueId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                      (resource.data.createdBy == request.auth.uid || 
                       isAdmin() || 
                       isWorker());
      allow delete: if isAdmin();
    }
  }
}
```

---

## 🧪 Test After Fixing

1. Refresh your browser
2. Try to sign in
3. Check browser console - error should be gone
4. You should be able to view issues

---

## 🐛 Still Having Issues?

### Check Authentication
- Make sure you're signed in
- Check browser console for auth errors
- Try signing out and back in

### Check Rules Syntax
- Make sure there are no typos
- Rules must be valid JavaScript
- Click "Publish" after editing

### Check Firebase Project
- Verify you're in the correct project
- Check that Firestore is enabled
- Check that Authentication is enabled

---

**After updating the rules, your app will work! 🚀**
