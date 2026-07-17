import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export const STARTING_WALLET_BALANCE = 1000;

export interface CustomerAccount {
  uid: string;
  accountNumber: string;
  fullName: string;
  phone: string | null;
  email: string;
  walletBalance: number;
  isVerified: boolean;
  createdAt: number | null;
}


export interface CreateCustomerInput {
  fullName: string;
  phone: string | null;
  email: string;
}

const COUNTER_START = 1_000_000_000; // first account_number = 1000000000 (10 digits)

const toAccount = (uid: string, d: any, fallbackAccountNumber?: string): CustomerAccount => ({
  uid,
  accountNumber: d.account_number ?? fallbackAccountNumber ?? "",
  fullName: d.full_name ?? "",
  phone: d.phone ?? null,
  email: d.email ?? "",
  walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : 0,
  isVerified: d.is_verified === true,
  createdAt: d.created_at?.toMillis?.() ?? null,
});

/**
 * Atomically:
 *  - reads/creates meta/counters.nextAccountNumber
 *  - reserves account_numbers/{n} (guarantees global uniqueness — no two customers can share)
 *  - writes customers/{uid} with account_number and starting wallet_balance
 * If customers/{uid} already exists, returns the existing account (and backfills
 * wallet_balance for legacy docs).
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
    if (typeof d.wallet_balance !== "number") {
      await updateDoc(customerRef, { wallet_balance: STARTING_WALLET_BALANCE });
      d.wallet_balance = STARTING_WALLET_BALANCE;
    }
    return toAccount(uid, d);
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
      throw new Error("account_number_collision");
    }

    tx.set(counterRef, { nextAccountNumber: next + 1 }, { merge: true });
    tx.set(reservationRef, { uid, createdAt: serverTimestamp() });
    tx.set(customerRef, {
      uid,
      role: "customer",
      account_number: candidate,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email,
      wallet_balance: STARTING_WALLET_BALANCE,
      is_verified: false,
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
    walletBalance: STARTING_WALLET_BALANCE,
    isVerified: false,
    createdAt: Date.now(),
  };
};

/** Admin/Nafath: mark a customer as verified. Rules require the customer to be signed in as themselves. */
export const setCustomerVerified = async (uid: string, verified: boolean): Promise<void> => {
  await updateDoc(doc(getDb(), "customers", uid), { is_verified: verified });
};

export const getCustomerByUid = async (
  uid: string,
): Promise<CustomerAccount | null> => {
  const snap = await getDoc(doc(getDb(), "customers", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  // Backfill legacy docs missing wallet_balance so rules comparisons work.
  if (typeof d.wallet_balance !== "number") {
    try {
      await updateDoc(doc(getDb(), "customers", uid), { wallet_balance: STARTING_WALLET_BALANCE });
      d.wallet_balance = STARTING_WALLET_BALANCE;
    } catch {
      /* ignore */
    }
  }
  return toAccount(uid, d);
};

/** Merchant-safe lookup: returns only the customer's UID for the given account_number. */
export const resolveAccountNumber = async (
  accountNumber: string,
): Promise<{ uid: string } | null> => {
  const snap = await getDoc(doc(getDb(), "account_numbers", accountNumber));
  if (!snap.exists()) return null;
  return { uid: (snap.data() as any).uid };
};
