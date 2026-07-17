import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { resolveAccountNumber } from "./firebaseCustomers";
import { getMerchantByUid } from "./firebaseMerchants";

export interface TransactionRecord {
  id: string;
  account_number: string;
  customer_uid: string;
  merchant_uid: string;
  merchant_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "failed";
  created_at: number | null;
}

/**
 * Merchant-initiated payment: resolves account_number → customer uid via the
 * public reservation index (which contains only the uid — no personal data),
 * then writes a linked transaction record.
 */
export const createMerchantTransaction = async (
  merchantUid: string,
  accountNumber: string,
  amount: number,
): Promise<string> => {
  if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
    throw new Error("رقم حساب غير صالح - يجب أن يكون 10 أرقام");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  }

  const merchant = await getMerchantByUid(merchantUid);
  if (!merchant) throw new Error("حساب التاجر غير موجود");

  const resolved = await resolveAccountNumber(accountNumber);
  if (!resolved) throw new Error("رقم الحساب غير موجود");

  const ref = await addDoc(collection(getDb(), "transactions"), {
    account_number: accountNumber,
    customer_uid: resolved.uid,
    merchant_uid: merchantUid,
    merchant_id: merchant.merchantId,
    amount,
    status: "pending",
    created_at: serverTimestamp(),
  });
  return ref.id;
};

const toRecord = (id: string, d: any): TransactionRecord => ({
  id,
  account_number: d.account_number,
  customer_uid: d.customer_uid,
  merchant_uid: d.merchant_uid,
  merchant_id: d.merchant_id,
  amount: Number(d.amount) || 0,
  status: d.status,
  created_at: (d.created_at as Timestamp | undefined)?.toMillis?.() ?? null,
});

export const subscribeMerchantTransactions = (
  merchantUid: string,
  cb: (list: TransactionRecord[]) => void,
) => {
  const q = query(
    collection(getDb(), "transactions"),
    where("merchant_uid", "==", merchantUid),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data()))));
};

export const subscribeCustomerTransactions = (
  customerUid: string,
  cb: (list: TransactionRecord[]) => void,
) => {
  const q = query(
    collection(getDb(), "transactions"),
    where("customer_uid", "==", customerUid),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data()))));
};
