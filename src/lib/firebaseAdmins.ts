import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export interface AdminRecord {
  uid: string;
  role: "admin";
  promoted_at: number | null;
  email?: string;
  full_name?: string;
}

export const promoteToAdmin = async (
  targetUid: string,
  meta?: { email?: string; full_name?: string }
) => {
  await setDoc(doc(getDb(), "admins", targetUid), {
    uid: targetUid,
    role: "admin",
    email: meta?.email ?? null,
    full_name: meta?.full_name ?? null,
    promoted_at: serverTimestamp(),
  });
};

export const demoteAdmin = async (targetUid: string) => {
  await deleteDoc(doc(getDb(), "admins", targetUid));
};

export const isUserAdmin = async (uid: string): Promise<boolean> => {
  const s = await getDoc(doc(getDb(), "admins", uid));
  return s.exists();
};

export const subscribeAdmins = (cb: (list: AdminRecord[]) => void) => {
  return onSnapshot(collection(getDb(), "admins"), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: d.id,
          role: "admin",
          promoted_at: data.promoted_at?.toMillis?.() ?? null,
          email: data.email ?? undefined,
          full_name: data.full_name ?? undefined,
        };
      })
    );
  });
};

export const listAdminsOnce = async (): Promise<AdminRecord[]> => {
  const snap = await getDocs(collection(getDb(), "admins"));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      role: "admin",
      promoted_at: data.promoted_at?.toMillis?.() ?? null,
      email: data.email ?? undefined,
      full_name: data.full_name ?? undefined,
    };
  });
};
