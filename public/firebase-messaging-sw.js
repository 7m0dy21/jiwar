// Firebase Cloud Messaging service worker
// This worker receives background push notifications.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// NOTE: These values are the *public* Firebase Web config from your Firebase project.
// Replace with your project's config from Firebase Console → Project Settings → General.
self.FIREBASE_CONFIG = self.FIREBASE_CONFIG || {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

try {
  firebase.initializeApp(self.FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "جوار";
    const options = {
      body: payload.notification?.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      data: payload.data || {},
    };
    self.registration.showNotification(title, options);
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification?.data?.click_action || "/";
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
        for (const w of wins) if ("focus" in w) return w.focus();
        return clients.openWindow(url);
      })
    );
  });
} catch (e) {
  // FCM not configured — worker stays inert
  console.warn("[fcm-sw] init skipped", e);
}
