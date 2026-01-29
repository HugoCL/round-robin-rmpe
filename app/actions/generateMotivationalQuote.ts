"use server";

interface Quote {
	text: string; // Traducción al español
	originalText?: string; // Texto original en el idioma de origen (si no es español)
	author: string;
}

// ZenQuotes API response interface
interface ZenQuoteResponse {
	q: string; // Quote text
	a: string; // Author
	h: string; // HTML formatted quote
}

const FALLBACK_QUOTES: Quote[] = [
	{
		text: "El único modo de hacer un gran trabajo es amar lo que haces.",
		author: "Steve Jobs",
	},
	{
		text: "La innovación distingue a un líder de un seguidor.",
		author: "Steve Jobs",
	},
	{
		text: "El futuro pertenece a quienes creen en la belleza de sus sueños.",
		author: "Eleanor Roosevelt",
	},
	{
		text: "El éxito no es la clave de la felicidad. La felicidad es la clave del éxito.",
		author: "Albert Schweitzer",
	},
	{
		text: "La mejor manera de predecir el futuro es crearlo.",
		author: "Peter Drucker",
	},
	{
		text: "El conocimiento es poder, pero el entusiasmo mueve montañas.",
		author: "Benjamin Disraeli",
	},
	{
		text: "Cada día es una nueva oportunidad para cambiar tu vida.",
		author: "Anónimo",
	},
	{
		text: "No cuentes los días, haz que los días cuenten.",
		author: "Muhammad Ali",
	},
];

export async function generateMotivationalQuote(): Promise<Quote> {
	try {
		const response = await fetch("https://zenquotes.io/api/today", {
			next: { revalidate: 86400 }, // Cache for 24 hours (quote changes daily)
		});

		if (!response.ok) {
			throw new Error("Failed to fetch quote from ZenQuotes API");
		}

		const data: ZenQuoteResponse[] = await response.json();

		if (!data || data.length === 0) {
			throw new Error("No quote returned from ZenQuotes API");
		}

		const zenQuote = data[0];

		return {
			text: zenQuote.q.trim(),
			author: zenQuote.a.trim(),
		};
	} catch (_e) {
		// If API fails, use fallback quotes
		return getRandomFallbackQuote();
	}
}

function getRandomFallbackQuote(): Quote {
	const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length);
	return FALLBACK_QUOTES[randomIndex];
}
