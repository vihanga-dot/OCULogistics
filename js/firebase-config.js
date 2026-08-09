// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCSP_zqKYRrir8mhJyOBm-9TUyPxJgIHwA",
  authDomain: "ousl-logistics-club.firebaseapp.com",
  projectId: "ousl-logistics-club",
  storageBucket: "ousl-logistics-club.firebasestorage.app",
  messagingSenderId: "101694755348",
  appId: "1:101694755348:web:27a631de942e074ed28d01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Cloudinary Configuration
// SECURITY NOTE: this preset is unsigned, meaning anyone who reads this
// public JS file (i.e. anyone) can POST directly to Cloudinary's upload API
// with this cloudName + uploadPreset, bypassing the site's editor-only gate
// entirely — the Firestore RBAC rules do NOT protect Cloudinary.
// For production, switch to a SIGNED upload preset and generate the
// signature server-side (e.g. a Firebase Cloud Function that checks the
// caller's Firebase ID token + accessLevel before signing), then call that
// function from uploadToCloudinary() instead of hitting Cloudinary directly.
export const CLOUDINARY_CONFIG = {
  cloudName: 'pc10akmw',
  uploadPreset: 'logistics_club_unsigned'
};