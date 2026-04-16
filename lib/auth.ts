// ============================================
// Authentication Helper Functions
// ============================================
// Wraps Firebase Auth operations and manages user
// profile documents in Firestore.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User, UserRole } from "@/types";

/**
 * Register a new user with email/password and store their profile in Firestore.
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: UserRole = "user"
): Promise<User> {
  try {
    console.log("🔐 Starting signup process...", { email, name, role });

    // Create the Firebase Auth user
    console.log("📝 Creating Firebase Auth user...");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("✅ Firebase Auth user created:", credential.user.uid);

    // Update the display name in Firebase Auth
    console.log("👤 Updating display name...");
    await updateProfile(credential.user, { displayName: name });
    console.log("✅ Display name updated");

    // Create the user profile document in Firestore
    const userProfile: User = {
      id: credential.user.uid,
      name,
      email,
      role,
      createdAt: new Date(),
    };

    console.log("💾 Saving user profile to Firestore...");
    await setDoc(doc(db, "users", credential.user.uid), {
      ...userProfile,
      createdAt: userProfile.createdAt.toISOString(),
    });
    console.log("✅ User profile saved to Firestore");

    console.log("🎉 Signup completed successfully!");
    return userProfile;
  } catch (error: unknown) {
    console.error("❌ Signup failed:", error);
    
    // Log detailed error information
    if (error && typeof error === 'object') {
      const firebaseError = error as { code?: string; message?: string };
      console.error("Error code:", firebaseError.code);
      console.error("Error message:", firebaseError.message);
    }
    
    // Re-throw the error so it can be caught by the calling function
    throw error;
  }
}

/**
 * Sign in an existing user with email/password.
 */
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Fetch a user's profile from Firestore by their UID.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      createdAt: new Date(data.createdAt),
    } as User;
  }

  return null;
}
