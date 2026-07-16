// Public Firebase Web config — safe to ship in the browser bundle.
// Get these values from Firebase Console → Project Settings → General → Your apps → Web app.
// The VAPID key comes from Project Settings → Cloud Messaging → Web configuration.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

export const isFirebaseConfigured = () =>
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId && !!VAPID_PUBLIC_KEY;
