import { SignIn } from "@clerk/nextjs";
import { List, Quote } from "lucide-react";
import Image from "next/image";
import { generateMotivationalQuote } from "@/app/actions/generateMotivationalQuote";
import { getRandomPhoto } from "@/lib/unsplash";

export default async function LoginPage() {
	const [photo, quote] = await Promise.all([
		getRandomPhoto("nature"),
		generateMotivationalQuote(),
	]);

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<a href="#" className="flex items-center gap-2 font-medium">
						<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
							<List className="size-4" />
						</div>
						La Lista
					</a>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<SignIn signUpUrl="/es/sign-up" />
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				{photo ? (
					<>
						<Image
							src={photo.url}
							alt={photo.alt}
							fill
							priority
							className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
						/>
						{/* Motivational Quote Overlay */}
						<div className="absolute inset-0 flex items-center justify-center p-8">
							<div className="max-w-lg rounded-2xl border border-white/20 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-md">
								<Quote className="mx-auto mb-4 size-10 text-white/80" />
								<blockquote className="mb-2 font-serif text-2xl font-medium leading-relaxed tracking-wide text-white">
									{quote.text}
								</blockquote>
								{quote.originalText && (
									<p className="mb-4 font-serif text-sm italic leading-relaxed text-white/60">
										{quote.originalText}
									</p>
								)}
								<cite className="font-serif text-base font-light tracking-wide text-white/70 not-italic">
									— {quote.author}
								</cite>
							</div>
						</div>
						<a
							href={photo.photographerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="absolute bottom-2 right-2 text-xs text-white/70 hover:text-white"
						>
							Photo by {photo.photographer}
						</a>
					</>
				) : (
					<div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-muted" />
				)}
			</div>
		</div>
	);
}
