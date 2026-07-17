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

export const signInCustomer = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const signOutCustomer = async () => {
  await fbSignOut(getFirebaseAuth());
};

export const subscribeAuth = (cb: (user: User | null) => void) =>
  onAuthStateChanged(getFirebaseAuth(), cb);
