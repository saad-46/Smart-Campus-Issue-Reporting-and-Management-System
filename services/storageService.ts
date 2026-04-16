// ============================================
// Storage Service
// ============================================
// Handles file uploads to Firebase Storage

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Uploads an image to Firebase Storage and returns its public URL
 * @param file The image File object
 * @param path Prefix for the storage path (e.g. "issues")
 */
export async function uploadImage(file: File, path: string = "issues"): Promise<string> {
  if (!file) throw new Error("No file provided");
  
  // Generate a unique filename to prevent overrides
  const uniqueName = Date.now() + "_" + Math.random().toString(36).substring(2, 9) + "_" + file.name;
  const storageRef = ref(storage, `${path}/${uniqueName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new Error("Failed to upload image. Ensure Firebase Storage is properly configured and enabled via the Firebase Console.");
  }
}
