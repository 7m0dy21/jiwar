import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/config/firebase";

export interface NotificationRecord {
  id: string;
  user_uid: string;
  title: string;
  body: string;
  type: "payment" | "deduction" | "alert" | "info";
  read: boolean;
  created_at: number | null;
}

export const pushNotification = async (
  userUid: string,
  n: { title: string; body: string; type?: NotificationRecord["type"] },
) => {
  await addDoc(collection(getDb(), "notifications"), {
    user_uid: userUid,
    title: n.title,
    body: n.body,
    type: n.type ?? "info",
    read: false,
    created_at: serverTimestamp(),
  });
};

export const subscribeNotifications = (
  userUid: string,
  cb: (list: NotificationRecord[]) => void,
) => {
  const q = query(
    collection(getDb(), "notifications"),
    where("user_uid", "==", userUid),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            user_uid: x.user_uid,
            title: x.title ?? "",
            body: x.body ?? "",
            type: x.type ?? "info",
            read: x.read === true,
            created_at: (x.created_at as Timestamp | undefined)?.toMillis?.() ?? null,
          };
        }),
      ),
    (err) => console.warn("notifications subscribe failed", err),
  );
};

export const markNotificationRead = async (id: string) => {
  await updateDoc(doc(getDb(), "notifications", id), { read: true });
};
