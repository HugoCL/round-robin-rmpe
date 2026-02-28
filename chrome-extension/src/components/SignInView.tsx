import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";

export function SignInView() {
	const handleSignIn = () => {
		// OAuth is not supported in Chrome Extension popups.
		// Open the web app so the user can sign in there —
		// the session syncs back to the extension via Clerk Sync Host.
		chrome.tabs.create({ url: "https://la-lista.vercel.app/es/sign-in" });
	};

	return (
		<div className="flex flex-col items-center justify-center p-8 text-center">
			<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
				<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
					<span className="text-primary-foreground text-lg font-bold">L</span>
				</div>
			</div>
			<h2 className="text-base font-semibold text-foreground mb-1">
				Bienvenido a La Lista
			</h2>
			<p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
				Inicia sesión en la app web para usar la extensión. Tu sesión se
				sincronizará automáticamente.
			</p>
			<Button onClick={handleSignIn} size="lg">
				Iniciar sesión en La Lista
			</Button>
			<p className="text-[10px] text-muted-foreground mt-3 max-w-[220px]">
				Después de iniciar sesión, cierra y vuelve a abrir este popup.
			</p>
		</div>
	);
}
