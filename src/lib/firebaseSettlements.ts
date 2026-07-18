import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export type SettlementStatus = "completed" | "under_review" | "rejected";

export interface SettlementRecord {
  id: string;
  merchant_uid: string;
  merchant_id: string;
  amount: number;
  status: SettlementStatus;
  reference: string;
  created_at: number | null;
}

const toRecord = (id: string, d: any): SettlementRecord => ({
  id,
  merchant_uid: d.merchant_uid,
  merchant_id: d.merchant_id ?? "",
  amount: Number(d.amount) || 0,
  status: (d.status as SettlementStatus) ?? "under_review",
  reference: d.reference ?? id.slice(0, 8).toUpperCase(),
  created_at: (d.created_at as Timestamp | undefined)?.toMillis?.() ?? null,
});

export const subscribeMerchantSettlements = (
  merchantUid: string,
  cb: (list: SettlementRecord[]) => void,
) => {
  const q = query(
    collection(getDb(), "settlements"),
    where("merchant_uid", "==", merchantUid),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data()))),
    (err) => {
      console.warn("settlements subscribe failed, returning empty", err);
      cb([]);
    },
  );
};

export const createSettlement = async (input: {
  merchantUid: string;
  merchantId: string;
  amount: number;
  status?: SettlementStatus;
}) => {
  await addDoc(collection(getDb(), "settlements"), {
    merchant_uid: input.merchantUid,
    merchant_id: input.merchantId,
    amount: input.amount,
    status: input.status ?? "under_review",
    reference: "STL-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    created_at: serverTimestamp(),
  });
};

export const updateSettlementStatus = async (id: string, status: SettlementStatus) => {
  await updateDoc(doc(getDb(), "settlements", id), { status });
};
