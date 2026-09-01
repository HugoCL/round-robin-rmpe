import { SignUp } from "@clerk/nextjs";
import { List } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { generateMotivationalQuote } from "@/app/actions/generateMotivationalQuote";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { getRandomPhoto } from "@/lib/unsplash";

export default async function SignUpPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const [photo, quote] = await Promise.all([
		getRandomPhoto("nature"),
		generateMotivationalQuote(),
	]);

	return (
		<main className="grid min-h-svh bg-background lg:grid-cols-2">
			<section className="relative hidden overflow-hidden bg-muted lg:block">
				{photo ? (
					<>
						<Image
							src={photo.url}
							alt={photo.alt}
							fill
							priority
							sizes="50vw"
							className="object-cover"
						/>
						<div
							aria-hidden="true"
							className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10"
						/>
						<div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
							<blockquote className="max-w-xl text-white">
								<p className="font-display text-2xl font-medium leading-snug tracking-tight xl:text-3xl">
									“{quote.text}”
								</p>
								{quote.originalText ? (
									<p className="mt-4 text-sm italic leading-relaxed text-white/65">
										{quote.originalText}
									</p>
								) : null}
								<cite className="mt-5 block text-sm font-medium text-white/75 not-italic">
									— {quote.author}
								</cite>
							</blockquote>
						</div>
						<a
							href={photo.photographerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="absolute right-6 top-6 text-xs text-white/65 transition-colors hover:text-white"
						>
							Photo by {photo.photographer}
						</a>
					</>
				) : (
					<div className="absolute inset-0 bg-primary/10" />
				)}
			</section>

			<section className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link
						href={`/${locale}`}
						className="flex items-center gap-2 font-medium"
					>
						<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
							<List className="size-4" />
						</div>
						La Lista
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-sm">
						<SignUp
							signInUrl={`/${locale}/sign-in`}
							appearance={clerkAppearance}
						/>
					</div>
				</div>
			</section>
		</main>
	);
}
