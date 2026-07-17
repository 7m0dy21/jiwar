import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export interface CustomerAccount {
  uid: string;
  accountNumber: string;
  fullName: string;
  phone: string | null;
  email: string;
  createdAt: number | null;
}

export interface CreateCustomerInput {
  fullName: string;
  phone: string | null;
  email: string;
}

const COUNTER_START = 1_000_000_000; // first account_number = 1000000000 (10 digits)

/**
 * Atomically:
 *  - reads/creates meta/counters.nextAccountNumber
 *  - reserves account_numbers/{n} (guarantees global uniqueness — no two customers can share)
 *  - writes customers/{uid} with account_number
 * If customers/{uid} already exists, returns the existing account.
 */
export const ensureCustomerAccount = async (
  uid: string,
  input: CreateCustomerInput,
): Promise<CustomerAccount> => {
  const db = getDb();
  const customerRef = doc(db, "customers", uid);
  const counterRef = doc(db, "meta", "counters");

  const existing = await getDoc(customerRef);
  if (existing.exists()) {
    const d = existing.data() as any;
    return {
      uid,
      accountNumber: d.account_number,
      fullName: d.full_name ?? "",
      phone: d.phone ?? null,
      email: d.email ?? "",
      createdAt: d.created_at?.toMillis?.() ?? null,
    };
  }

  const accountNumber = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next: number = counterSnap.exists()
      ? (counterSnap.data() as any).nextAccountNumber ?? COUNTER_START
      : COUNTER_START;

    const candidate = String(next);
    const reservationRef = doc(db, "account_numbers", candidate);
    const reservation = await tx.get(reservationRef);
    if (reservation.exists()) {
      // Extremely unlikely but bail so caller retries
      throw new Error("account_number_collision");
    }

    tx.set(counterRef, { nextAccountNumber: next + 1 }, { merge: true });
    tx.set(reservationRef, { uid, createdAt: serverTimestamp() });
    tx.set(customerRef, {
      uid,
      account_number: candidate,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email,
      created_at: serverTimestamp(),
    });
    return candidate;
  });

  return {
    uid,
    accountNumber,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    createdAt: Date.now(),
  };
};

export const getCustomerByUid = async (
  uid: string,
): Promise<CustomerAccount | null> => {
  const snap = await getDoc(doc(getDb(), "customers", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    uid,
    accountNumber: d.account_number,
    fullName: d.full_name ?? "",
    phone: d.phone ?? null,
    email: d.email ?? "",
    createdAt: d.created_at?.toMillis?.() ?? null,
  };
};

/** Merchant-safe lookup: returns only the customer's UID for the given account_number. */
export const resolveAccountNumber = async (
  accountNumber: string,
): Promise<{ uid: string } | null> => {
  const snap = await getDoc(doc(getDb(), "account_numbers", accountNumber));
  if (!snap.exists()) return null;
  return { uid: (snap.data() as any).uid };
};
