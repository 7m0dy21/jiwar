import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/config/firebase";
import { ensureCustomerAccount } from "./firebaseCustomers";
import { ensureMerchantAccount } from "./firebaseMerchants";

export type UserRole = "customer" | "merchant";

/**
 * Spark-plan architecture: roles are stored as a `role` field on the
 * customers/{uid} or merchants/{uid} profile document. Security rules check
 * `exists(/merchants/$(uid))` (or /customers/) instead of a Custom Claim,
 * so there is nothing to wait for after signup.
 */


export const signUpCustomer = async (
  email: string,
  password: string,
  fullName: string,
  phone?: string,
) => {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName) await updateProfile(cred.user, { displayName: fullName });
  const account = await ensureCustomerAccount(cred.user.uid, {
    fullName,
    phone: phone ?? null,
    email,
  });
  return { user: cred.user, account };
};

export const signUpMerchant = async (
  email: string,
  password: string,
  storeName: string,
  phone?: string,
) => {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (storeName) await updateProfile(cred.user, { displayName: storeName });
  const account = await ensureMerchantAccount(cred.user.uid, {
    storeName,
    phone: phone ?? null,
    email,
  });
  return { user: cred.user, account };
};

export const signInEmail = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const signOutUser = async () => {
  await fbSignOut(getFirebaseAuth());
};

export const subscribeAuth = (cb: (user: User | null) => void) =>
  onAuthStateChanged(getFirebaseAuth(), cb);

// Legacy alias for FirebasePhase1 page.
export const signInCustomer = signInEmail;
export const signOutCustomer = signOutUser;
