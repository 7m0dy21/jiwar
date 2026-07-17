// Public Firebase Web config — safe to ship in the browser bundle.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

export const isFirebaseConfigured = () =>
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let _app: FirebaseApp | null = null;
export const getFirebaseApp = (): FirebaseApp => {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
};

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());
export const getDb = (): Firestore => getFirestore(getFirebaseApp());
