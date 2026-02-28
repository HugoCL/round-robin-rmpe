import { Switch } from "@/ui/switch";

interface ChatToggleProps {
	sendChat: boolean;
	onToggle: (value: boolean) => void;
}

export function ChatToggle({ sendChat, onToggle }: ChatToggleProps) {
	return (
		<div className="mx-4 mt-3 mb-1">
			<label className="flex items-center justify-between cursor-pointer group">
				<div className="flex items-center gap-2">
					<svg
						className="size-4 text-muted-foreground"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={1.5}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
						/>
					</svg>
					<span className="text-xs text-foreground group-hover:text-foreground/80 transition-colors">
						Enviar notificación de Google Chat
					</span>
				</div>
				<Switch checked={sendChat} onCheckedChange={onToggle} />
			</label>
		</div>
	);
}
