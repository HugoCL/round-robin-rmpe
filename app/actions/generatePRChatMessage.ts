"use server";
import { generateObject } from "ai";
import z from "zod/v4";
import {
	GOOGLE_CHAT_PR_LINK_PLACEHOLDER,
	GOOGLE_CHAT_REQUESTER_PLACEHOLDER,
	GOOGLE_CHAT_REVIEWER_PLACEHOLDER,
	getDefaultPRChatMessageTemplate,
	REQUIRED_PR_CHAT_PLACEHOLDERS,
} from "@/lib/googleChatMessageTemplate";

interface GenerateArgs {
	mods?: string[]; // stylistic modifiers
	customPrompt?: string;
	locale?: string;
}

function getErrorSummary(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}
	if (typeof error === "string") {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return "Error desconocido (no serializable)";
	}
}

export async function generatePRChatMessage({
	mods,
	customPrompt,
	locale,
}: GenerateArgs): Promise<{ response: string }> {
	const gatewayUrl = process.env.AI_GATEWAY_API_KEY;
	if (!gatewayUrl) {
		return { response: "No configurado: AI_GATEWAY_API_KEY" };
	}

	// Base system prompt
	let system = `Eres un asistente que genera mensajes breves para avisar que hay que revisar un Pull Request.

	REQUISITOS ESTRICTOS (NO LOS ROMPAS):
	1. Siempre debes incluir EXACTAMENTE estos placeholders una sola vez cada uno: ${GOOGLE_CHAT_REVIEWER_PLACEHOLDER} ${GOOGLE_CHAT_REQUESTER_PLACEHOLDER} ${GOOGLE_CHAT_PR_LINK_PLACEHOLDER}
	2. No reemplaces ni traduzcas los placeholders. No cambies "URL_PLACEHOLDER" ni "PR" dentro del formato de enlace.
	3. El formato del enlace debe ser exactamente: ${GOOGLE_CHAT_PR_LINK_PLACEHOLDER} (con los símbolos <, > y la barra vertical).
	4. No añadas otros enlaces ni repitas el placeholder de PR.
	5. Mensaje de 1 o 2 líneas, máximo 280 caracteres (límite duro 400). Tono amistoso, divertido, español latino neutral (a menos que se te diga lo contrario).
	6. Puedes usar emojis moderados. Sin comillas ni markdown.
	7. No inventes datos; sólo placeholders.

	Si violas una regla se usará un fallback.`;

	// Strengthen style modifier weighting: build an ESTILO block summarizing chosen modifiers first
	if (mods && mods.length > 0) {
		const styleDirectives: string[] = [];
		for (const mod of mods) {
			switch (mod) {
				case "funny":
					styleDirectives.push(
						"Humor notorio y chistes de programación (sin sarcasmo negativo)",
					);
					break;
				case "references":
					styleDirectives.push(
						"Al menos 1 referencia breve y natural a cultura pop / películas / series / refranes / memes. Evita referencias genéricas repetidas y prioriza variedad.",
					);
					break;
				case "spanglish":
					styleDirectives.push(
						"Mezcla evidente de español e inglés (Spanglish) en varias palabras, mantén placeholders intactos",
					);
					break;
				case "formal":
					styleDirectives.push(
						"Registro formal y profesional, cordial, sin jerga excesiva",
					);
					break;
				case "motivational":
					styleDirectives.push(
						"Tono motivacional / inspirador, refuerza impacto o trabajo en equipo",
					);
					break;
				case "pirate":
					styleDirectives.push(
						"Jerga pirata evidente (¡arrr!, abordaje, tesoro del PR) adaptada al desarrollo",
					);
					break;
			}
		}
		if (styleDirectives.length > 0) {
			// Prepend an emphasized style block so model treats it as high priority after rules
			system += `\n\nESTILO (aplica TODAS las seleccionadas, sin sacrificar reglas de placeholders):\n- ${styleDirectives.join("\n- ")}\n`;
		}
	}

	if (customPrompt?.trim()) {
		system += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO (debes seguirlas sin romper las reglas estrictas):\n- ${customPrompt.trim()}`;
	}

	const prompt = `Genera el mensaje cumpliendo estrictamente las reglas.`;

	try {
		let attempts = 0;
		let finalText = "";
		const REQUIRED = REQUIRED_PR_CHAT_PLACEHOLDERS;

		while (attempts < 2) {
			attempts++;
			const { object } = await generateObject({
				schema: z.object({
					response: z.string().min(1).max(400),
				}),
				model: "google/gemini-3-flash",
				prompt,
				system,
			});
			const candidate = object.response ? object.response.trim() : "";

			const hasAll = REQUIRED.every((p: string) => candidate.includes(p));
			const duplicates = REQUIRED.some(
				(p: string) => candidate.split(p).length - 1 > 1,
			);
			if (hasAll && !duplicates) {
				finalText = candidate;
				break;
			}
			if (attempts === 1) continue;
		}

		if (!finalText) {
			finalText = getDefaultPRChatMessageTemplate(locale);
		}

		if (finalText.length > 400) finalText = `${finalText.slice(0, 397)}...`;
		return { response: finalText };
	} catch (error) {
		const errorSummary = getErrorSummary(error);
		const isProduction = process.env.NODE_ENV === "production";
		const exposeServerErrors = process.env.EXPOSE_SERVER_ERRORS === "true";
		console.error("[generatePRChatMessage] AI generation failed", {
			model: "google/gemini-3-flash",
			errorSummary,
			hasGatewayKey: Boolean(gatewayUrl),
			...(isProduction ? {} : { error }),
		});

		if (!isProduction && exposeServerErrors) {
			const safeSummary = errorSummary.slice(0, 220);
			return { response: `Error generando mensaje: ${safeSummary}` };
		}

		return { response: "Error generando mensaje" };
	}
}
