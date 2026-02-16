// Service Worker for Push Notifications
// This file handles push events and notification clicks

function isFirefoxBrowser() {
	return /firefox/i.test(self.navigator?.userAgent || "");
}

async function closeAllNotifications() {
	const notifications = await self.registration.getNotifications();
	for (const notification of notifications) {
		notification.close();
	}
}

function clearNotificationsForFirefox() {
	if (!isFirefoxBrowser()) return Promise.resolve();
	return closeAllNotifications();
}

self.addEventListener("push", (event) => {
	if (event.data) {
		const data = event.data.json();
		const options = {
			body: data.body,
			icon: data.icon || "/icon-192x192.png",
			vibrate: [100, 50, 100],
			data: {
				url: data.url || "/",
				dateOfArrival: Date.now(),
			},
			tag: data.tag || "default",
			requireInteraction: data.requireInteraction || false,
		};
		if (!isFirefoxBrowser()) {
			options.badge = "/icon-192x192.png";
		}

		event.waitUntil(self.registration.showNotification(data.title, options));
	}
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const url = event.notification.data?.url || "/";

	event.waitUntil(
		Promise.all([
			clearNotificationsForFirefox(),
			clients
				.matchAll({ type: "window", includeUncontrolled: true })
				.then((clientList) => {
					// Check if there's already a window open
					for (const client of clientList) {
						if (
							client.url.includes(self.location.origin) &&
							"focus" in client
						) {
							client.navigate(url);
							return client.focus();
						}
					}
					// Open a new window if none exists
					if (clients.openWindow) {
						return clients.openWindow(url);
					}
				}),
		]),
	);
});

// Listen for skip waiting message from the client
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
	if (event.data && event.data.type === "CLEAR_NOTIFICATIONS") {
		event.waitUntil(clearNotificationsForFirefox());
	}
});
