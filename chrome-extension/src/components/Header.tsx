import { UserButton, useUser } from "@clerk/chrome-extension";
import { Button } from "@/ui/button";

export function Header() {
	const { user, isSignedIn } = useUser();

	return (
		<header className="flex items-center justify-between px-4 py-3 border-b border-border">
			<h1 className="text-base font-bold text-foreground tracking-tight">
				Revisión PR
			</h1>

			<div className="flex items-center gap-2">
				{isSignedIn ? (
					<UserButton
						afterSignOutUrl="/"
						appearance={{
							elements: { avatarBox: "w-7 h-7" },
						}}
					/>
				) : (
					<Button
						size="sm"
						variant="outline"
						onClick={() =>
							chrome.tabs.create({
								url: "https://la-lista.vercel.app/es/sign-in",
							})
						}
					>
						Iniciar sesión
					</Button>
				)}
			</div>
		</header>
	);
}
