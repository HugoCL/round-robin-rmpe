"use server";
import { generateObject } from "ai";
import z from "zod/v4";

interface GenerateArgs {
	mods?: string[]; // stylistic modifiers
}

export async function generatePRChatMessage({
	mods,
}: GenerateArgs): Promise<{ response: string }> {
	const gatewayUrl = process.env.AI_GATEWAY_API_KEY;
	if (!gatewayUrl) {
		return { response: "No configurado: AI_GATEWAY_API_KEY" };
	}

	// Base system prompt
	let system = `Eres un asistente que genera mensajes breves para avisar que hay que revisar un Pull Request.

	REQUISITOS ESTRICTOS (NO LOS ROMPAS):
	1. Siempre debes incluir EXACTAMENTE estos placeholders una sola vez cada uno: {{reviewer_name}} {{requester_name}} <URL_PLACEHOLDER|PR>
	2. No reemplaces ni traduzcas los placeholders. No cambies "URL_PLACEHOLDER" ni "PR" dentro del formato de enlace.
	3. El formato del enlace debe ser exactamente: <URL_PLACEHOLDER|PR> (con los símbolos <, > y la barra vertical).
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
						"Al menos 1 referencia breve y natural a cultura pop / películas / series / refranes / memes.",
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

	const prompt = `Genera el mensaje cumpliendo estrictamente las reglas.`;

	try {
		let attempts = 0;
		let finalText = "";
		const REQUIRED = [
			"{{reviewer_name}}",
			"{{requester_name}}",
			"<URL_PLACEHOLDER|PR>",
		] as const;

		while (attempts < 2) {
			attempts++;
			const { object } = await generateObject({
				schema: z.object({
					response: z.string().min(1).max(400),
				}),
				model: "openai/gpt-4.1-mini",
				prompt,
				system,
			});
			const candidate = object.response ? object.response.trim() : "";

			const hasAll = REQUIRED.every((p) => candidate.includes(p));
			const duplicates = REQUIRED.some(
				(p) => candidate.split(p).length - 1 > 1,
			);
			if (hasAll && !duplicates) {
				finalText = candidate;
				break;
			}
			if (attempts === 1) continue;
		}

		if (!finalText) {
			finalText = `Hey {{reviewer_name}} 👋 hay un nuevo PR <URL_PLACEHOLDER|PR> de {{requester_name}} listo para tu review. ¡Gracias!`;
		}

		if (finalText.length > 400) finalText = finalText.slice(0, 397) + "...";
		return { response: finalText };
	} catch (_e) {
		return { response: "Error generando mensaje" };
	}
}
