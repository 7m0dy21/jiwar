import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/config/firebase";
import { subscribeAuth, signOutUser } from "@/lib/firebaseAuth";

export type AppRole = "admin" | "merchant" | "customer" | null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: AppRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>(null);

  useEffect(() => {
    const unsub = subscribeAuth(async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }
      const db = getDb();
      try {
        const [adminSnap, merchantSnap, customerSnap] = await Promise.all([
          getDoc(doc(db, "admins", u.uid)),
          getDoc(doc(db, "merchants", u.uid)),
          getDoc(doc(db, "customers", u.uid)),
        ]);
        if (adminSnap.exists()) setRole("admin");
        else if (merchantSnap.exists()) setRole("merchant");
        else if (customerSnap.exists()) setRole("customer");
        else setRole(null);
      } catch (err) {
        console.error("role resolve failed", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
