"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export type PushNotificationStatus =
	| "unsupported"
	| "denied"
	| "prompt"
	| "subscribed"
	| "unsubscribed";

interface UsePushNotificationsOptions {
	userEmail: string;
}

interface UsePushNotificationsReturn {
	status: PushNotificationStatus;
	isLoading: boolean;
	subscribe: () => Promise<boolean>;
	unsubscribe: () => Promise<boolean>;
	isSupported: boolean;
}

export function usePushNotifications({
	userEmail,
}: UsePushNotificationsOptions): UsePushNotificationsReturn {
	const [status, setStatus] = useState<PushNotificationStatus>("unsupported");
	const [isLoading, setIsLoading] = useState(false);
	const [isSupported, setIsSupported] = useState(false);

	const savePushSubscription = useMutation(api.mutations.savePushSubscription);
	const removePushSubscription = useMutation(
		api.mutations.removePushSubscription,
	);

	// Check support and current subscription status
	useEffect(() => {
		if (typeof window === "undefined") return;

		const checkSupport = async () => {
			if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
				setStatus("unsupported");
				setIsSupported(false);
				return;
			}

			setIsSupported(true);

			// Check notification permission
			const permission = Notification.permission;
			if (permission === "denied") {
				setStatus("denied");
				return;
			}

			// Check if already subscribed
			try {
				const registration = await navigator.serviceWorker.ready;
				const subscription = await registration.pushManager.getSubscription();
				if (subscription) {
					setStatus("subscribed");
				} else {
					setStatus(permission === "granted" ? "unsubscribed" : "prompt");
				}
			} catch (error) {
				console.error("Error checking push subscription:", error);
				setStatus("prompt");
			}
		};

		// Register service worker first
		const registerServiceWorker = async () => {
			try {
				await navigator.serviceWorker.register("/sw.js", {
					scope: "/",
					updateViaCache: "none",
				});
				await checkSupport();
			} catch (error) {
				console.error("Service worker registration failed:", error);
				setStatus("unsupported");
			}
		};

		registerServiceWorker();
	}, []);

	const subscribe = useCallback(async (): Promise<boolean> => {
		if (!isSupported || !userEmail) return false;

		setIsLoading(true);
		try {
			const registration = await navigator.serviceWorker.ready;

			const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
			if (!vapidPublicKey) {
				console.error("VAPID public key not configured");
				setIsLoading(false);
				return false;
			}

			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
			});

			// Extract the subscription data
			const subscriptionJSON = subscription.toJSON();
			if (!subscriptionJSON.endpoint || !subscriptionJSON.keys) {
				throw new Error("Invalid subscription data");
			}

			// Save to Convex
			await savePushSubscription({
				email: userEmail,
				subscription: {
					endpoint: subscriptionJSON.endpoint,
					keys: {
						p256dh: subscriptionJSON.keys.p256dh!,
						auth: subscriptionJSON.keys.auth!,
					},
				},
			});

			setStatus("subscribed");
			setIsLoading(false);
			return true;
		} catch (error) {
			console.error("Failed to subscribe to push notifications:", error);
			setIsLoading(false);
			return false;
		}
	}, [isSupported, userEmail, savePushSubscription]);

	const unsubscribe = useCallback(async (): Promise<boolean> => {
		setIsLoading(true);
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();

			if (subscription) {
				// Unsubscribe from push manager
				await subscription.unsubscribe();

				// Remove from Convex
				await removePushSubscription({
					endpoint: subscription.endpoint,
				});
			}

			setStatus("unsubscribed");
			setIsLoading(false);
			return true;
		} catch (error) {
			console.error("Failed to unsubscribe from push notifications:", error);
			setIsLoading(false);
			return false;
		}
	}, [removePushSubscription]);

	return {
		status,
		isLoading,
		subscribe,
		unsubscribe,
		isSupported,
	};
}
