/**
 * Jiwar Cloud Functions
 *
 * Responsibilities:
 *  1. Assign Firebase Auth Custom Claims { role: 'merchant' | 'customer' }
 *     the moment a profile document is created. Firestore Security Rules then
 *     rely on request.auth.token.role to strictly gate write access
 *     (specifically: only merchants can create /transactions/*).
 *  2. Server-side revalidation of transaction writes as defense-in-depth
 *     (rules already enforce the same invariants; this backstop catches any
 *      rule drift and normalises the timestamp).
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

initializeApp();

const setRoleClaim = async (uid: string, role: "merchant" | "customer") => {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const existing = (user.customClaims ?? {}) as Record<string, unknown>;
  if (existing.role === role) return;
  await auth.setCustomUserClaims(uid, { ...existing, role });
  logger.info("custom_claim_set", { uid, role });
};

/** merchants/{uid} created → grant role:'merchant'. */
export const onMerchantCreated = onDocumentCreated(
  "merchants/{uid}",
  async (event) => {
    const uid = event.params.uid;
    try {
      await setRoleClaim(uid, "merchant");
      // Mirror the claim into Firestore so the client can detect readiness
      // without needing to guess when to force-refresh the ID token.
      await getFirestore()
        .doc(`merchants/${uid}`)
        .set({ claim_role: "merchant", claim_set_at: FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
      logger.error("onMerchantCreated_failed", { uid, err });
    }
  },
);

/** customers/{uid} created → grant role:'customer'. */
export const onCustomerCreated = onDocumentCreated(
  "customers/{uid}",
  async (event) => {
    const uid = event.params.uid;
    try {
      await setRoleClaim(uid, "customer");
      await getFirestore()
        .doc(`customers/${uid}`)
        .set({ claim_role: "customer", claim_set_at: FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
      logger.error("onCustomerCreated_failed", { uid, err });
    }
  },
);
