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
 * Custom claims (role) are set asynchronously by a Cloud Function that fires
 * on customers/{uid} or merchants/{uid} creation. This helper polls the ID
 * token until the expected role appears (or times out) so that the very next
 * Firestore write — which the rules now gate on request.auth.token.role —
 * won't be rejected as "permission-denied".
 */
export const waitForRoleClaim = async (
  role: UserRole,
  { timeoutMs = 15000, intervalMs = 1000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> => {
  const auth = getFirebaseAuth();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdTokenResult(true);
    if ((token.claims as any).role === role) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
};

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
