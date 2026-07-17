# Jiwar Cloud Functions

Assigns Firebase Auth custom claims (`role: 'merchant' | 'customer'`) whenever
a matching profile document is created in Firestore. The client refreshes its
ID token after signup and the security rules gate `/transactions` writes with
`request.auth.token.role == 'merchant'`.

## Deploy

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Then deploy the updated rules:

```bash
firebase deploy --only firestore:rules
```

## What runs

- `onMerchantCreated` — Firestore trigger on `merchants/{uid}`; sets
  `role: 'merchant'` and mirrors `claim_role` back into the doc.
- `onCustomerCreated` — Firestore trigger on `customers/{uid}`; sets
  `role: 'customer'`.

## Backfill for existing users

For accounts created before these functions existed, run in the Firebase
Console shell or a one-off admin script:

```js
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();
for (const kind of ['merchant', 'customer']) {
  const snap = await db.collection(kind + 's').get();
  for (const d of snap.docs) {
    await getAuth().setCustomUserClaims(d.id, { role: kind });
  }
}
```
