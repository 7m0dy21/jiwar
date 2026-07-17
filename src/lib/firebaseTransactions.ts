import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { resolveAccountNumber } from "./firebaseCustomers";
import { getMerchantByUid } from "./firebaseMerchants";

export type TransactionStatus = "pending" | "completed" | "declined" | "failed";

export interface TransactionRecord {
  id: string;
  account_number: string;
  customer_uid: string;
  merchant_uid: string;
  merchant_id: string;
  amount: number;
  status: TransactionStatus;
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
  if (!merchant) {
    throw new Error("حساب التاجر غير موجود - لا تملك صلاحية إنشاء عمليات دفع");
  }


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

/** Real-time listener for pending transactions awaiting the customer's response. */
export const subscribePendingForCustomer = (
  customerUid: string,
  cb: (list: TransactionRecord[]) => void,
) => {
  const q = query(
    collection(getDb(), "transactions"),
    where("customer_uid", "==", customerUid),
    where("status", "==", "pending"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data()))));
};

/** Customer responds to a pending transaction. Rules enforce ownership + immutable fields. */
export const respondToTransaction = async (
  txId: string,
  approve: boolean,
): Promise<void> => {
  await updateDoc(doc(getDb(), "transactions", txId), {
    status: approve ? "completed" : "declined",
    responded_at: serverTimestamp(),
  });
};
