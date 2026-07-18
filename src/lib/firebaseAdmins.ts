import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export type AdminPermission = "view_only" | "edit_limits" | "full_access";

export interface AdminRecord {
  uid: string;
  role: "admin";
  promoted_at: number | null;
  email?: string;
  full_name?: string;
  permission?: AdminPermission;
  is_super?: boolean;
}

export const promoteToAdmin = async (
  targetUid: string,
  meta?: { email?: string; full_name?: string; permission?: AdminPermission },
) => {
  await setDoc(doc(getDb(), "admins", targetUid), {
    uid: targetUid,
    role: "admin",
    email: meta?.email ?? null,
    full_name: meta?.full_name ?? null,
    permission: meta?.permission ?? "view_only",
    is_super: false,
    promoted_at: serverTimestamp(),
  });
};

export const setAdminPermission = async (uid: string, permission: AdminPermission) => {
  await updateDoc(doc(getDb(), "admins", uid), { permission });
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
          permission: (data.permission as AdminPermission) ?? "view_only",
          is_super: data.is_super === true,
        };
      }),
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
      permission: (data.permission as AdminPermission) ?? "view_only",
      is_super: data.is_super === true,
    };
  });
};
