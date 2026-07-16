// Firebase Cloud Messaging service worker
// Receives background push notifications.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

self.FIREBASE_CONFIG = {
  apiKey: "AIzaSyA1bCYz9KTz8fjvsagFZPze6iD9mrMv2_Q",
  authDomain: "jiwar-app-47e65.firebaseapp.com",
  projectId: "jiwar-app-47e65",
  messagingSenderId: "325628882573",
  appId: "1:325628882573:web:36b4d98521d82246c2fcc4",
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
  console.warn("[fcm-sw] init skipped", e);
}
