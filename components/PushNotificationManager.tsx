"use client";

import {
	Notification01Icon,
	Notification02Icon,
	NotificationOff01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface PushNotificationManagerProps {
	userEmail: string;
	compact?: boolean;
}

export function PushNotificationManager({
	userEmail,
	compact = false,
}: PushNotificationManagerProps) {
	const { status, isLoading, subscribe, unsubscribe, isSupported } =
		usePushNotifications({ userEmail });

	if (!isSupported) {
		return null; // Don't show anything if push is not supported
	}

	const handleToggle = async (checked: boolean) => {
		if (checked) {
			await subscribe();
		} else {
			await unsubscribe();
		}
	};

	const isEnabled = status === "subscribed";
	const canEnable = status === "prompt" || status === "unsubscribed";
	const isDenied = status === "denied";

	if (compact) {
		return (
			<div className="flex items-center gap-2">
				<Switch
					id="push-notifications"
					checked={isEnabled}
					onCheckedChange={handleToggle}
					disabled={isLoading || isDenied}
				/>
				<Label
					htmlFor="push-notifications"
					className="text-sm cursor-pointer flex items-center gap-1.5"
				>
					<HugeiconsIcon
						icon={isEnabled ? Notification01Icon : NotificationOff01Icon}
						className="h-4 w-4"
					/>
					Notificaciones
				</Label>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-4 rounded-lg border bg-card">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<HugeiconsIcon
						icon={isEnabled ? Notification02Icon : NotificationOff01Icon}
						className="h-5 w-5 text-muted-foreground"
					/>
					<div>
						<p className="font-medium text-sm">Notificaciones Push</p>
						<p className="text-xs text-muted-foreground">
							{isDenied
								? "Bloqueadas por el navegador"
								: isEnabled
									? "Recibirás notificaciones de PRs y eventos"
									: "Activa para recibir alertas"}
						</p>
					</div>
				</div>
				{isDenied ? (
					<Button variant="outline" size="sm" disabled>
						Bloqueado
					</Button>
				) : (
					<Switch
						checked={isEnabled}
						onCheckedChange={handleToggle}
						disabled={isLoading}
					/>
				)}
			</div>
		</div>
	);
}
