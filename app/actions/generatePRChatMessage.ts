"use server";
import { generateObject } from "ai";
import z from "zod/v4";

interface GenerateArgs {
    reviewer_name: string;
    requester_name: string;
    pr: string;
    locale?: string;
}

export async function generatePRChatMessage({ reviewer_name, requester_name, pr }: GenerateArgs): Promise<{ response: string }> {
    const gatewayUrl = process.env.AI_GATEWAY_API_KEY;
    if (!gatewayUrl) {
        return { response: "No configurado: AI_GATEWAY_API_KEY" };
    }

    const system = `Ayuda a crear mensajes para avisar al compañero que debe revisar un PR. Tono amistoso y divertido. Siempre en español latino. Mantén los placeholders tal cual: {{reviewer_name}}, {{requester_name}}, {{PR}} si aparecen. Si ya vienen reemplazados, respétalos.`;
    const prompt = `Genera un mensaje. Datos:\n- Revisor: ${reviewer_name}\n- Solicitante: ${requester_name}\n- PR: ${pr}\nDevuélvelo como texto plano sin comillas.`;

    try {
        const { object } = await generateObject({
            schema: z.object({
                response: z.string().max(300),
            }),
            model: 'openai/gpt-5-nano',
            prompt: prompt,
            system: system,
        });
        return object.response ? { response: object.response.trim() } : { response: "Error: respuesta vacía" };
    } catch (e) {
        return { response: 'Error generando mensaje' };
    }
}
