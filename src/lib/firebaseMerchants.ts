import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export const MERCHANT_STARTING_BALANCE = 0;

export interface MerchantAccount {
  uid: string;
  merchantId: string;
  storeName: string;
  phone: string | null;
  email: string;
  walletBalance: number;
  createdAt: number | null;
}

const MERCHANT_COUNTER_START = 100_000; // 6-digit merchant ids: M100000+

const toMerchant = (uid: string, d: any): MerchantAccount => ({
  uid,
  merchantId: d.merchant_id,
  storeName: d.store_name ?? "",
  phone: d.phone ?? null,
  email: d.email ?? "",
  walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : 0,
  createdAt: d.created_at?.toMillis?.() ?? null,
});

export const ensureMerchantAccount = async (
  uid: string,
  input: { storeName: string; phone: string | null; email: string },
): Promise<MerchantAccount> => {
  const db = getDb();
  const merchantRef = doc(db, "merchants", uid);
  const counterRef = doc(db, "meta", "counters");

  const existing = await getDoc(merchantRef);
  if (existing.exists()) {
    const d = existing.data() as any;
    if (typeof d.wallet_balance !== "number") {
      await updateDoc(merchantRef, { wallet_balance: MERCHANT_STARTING_BALANCE });
      d.wallet_balance = MERCHANT_STARTING_BALANCE;
    }
    return toMerchant(uid, d);
  }

  const merchantId = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next: number = counterSnap.exists()
      ? (counterSnap.data() as any).nextMerchantId ?? MERCHANT_COUNTER_START
      : MERCHANT_COUNTER_START;

    const candidate = "M" + String(next);
    const reservationRef = doc(db, "merchant_ids", candidate);
    const reservation = await tx.get(reservationRef);
    if (reservation.exists()) throw new Error("merchant_id_collision");

    tx.set(counterRef, { nextMerchantId: next + 1 }, { merge: true });
    tx.set(reservationRef, { uid, createdAt: serverTimestamp() });
    tx.set(merchantRef, {
      uid,
      role: "merchant",
      merchant_id: candidate,
      store_name: input.storeName,
      phone: input.phone,
      email: input.email,
      wallet_balance: MERCHANT_STARTING_BALANCE,
      is_verified: false,
      created_at: serverTimestamp(),
    });

    return candidate;
  });

  return {
    uid,
    merchantId,
    storeName: input.storeName,
    phone: input.phone,
    email: input.email,
    walletBalance: MERCHANT_STARTING_BALANCE,
    createdAt: Date.now(),
  };
};

export const getMerchantByUid = async (uid: string): Promise<MerchantAccount | null> => {
  const snap = await getDoc(doc(getDb(), "merchants", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  if (typeof d.wallet_balance !== "number") {
    try {
      await updateDoc(doc(getDb(), "merchants", uid), { wallet_balance: MERCHANT_STARTING_BALANCE });
      d.wallet_balance = MERCHANT_STARTING_BALANCE;
    } catch {
      /* ignore */
    }
  }
  return toMerchant(uid, d);
};
