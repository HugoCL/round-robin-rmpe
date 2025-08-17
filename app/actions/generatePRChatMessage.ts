"use server";
import { generateObject } from "ai";
import z from "zod/v4";

interface GenerateArgs {
    reviewer_name: string;
    requester_name: string;
    pr: string;
    locale?: string;
    mods?: string[];
}

export async function generatePRChatMessage({ reviewer_name, requester_name, pr, mods }: GenerateArgs): Promise<{ response: string }> {
    const gatewayUrl = process.env.AI_GATEWAY_API_KEY;
    if (!gatewayUrl) {
        return { response: "No configurado: AI_GATEWAY_API_KEY" };
    }

    // Base system prompt
    let system = `Ayuda a crear mensajes para avisar al compañero que debe revisar un PR. Tono amistoso y divertido. Siempre en español latino. Mantén los placeholders tal cual: {{reviewer_name}}, {{requester_name}}, {{PR}} si aparecen. Si ya vienen reemplazados, respétalos.`;

    // Modify system prompt based on selected mods
    if (mods && mods.length > 0) {
        for (const mod of mods) {
            switch (mod) {
                case 'funny':
                    system += ` Hazlo extra divertido con humor y chistes relacionados al código o desarrollo.`;
                    break;
                case 'references':
                    system += ` Incluye referencias a películas, series, libros o cultura pop de manera creativa.`;
                    break;
                case 'spanglish':
                    system += ` Úsalo en spanglish mezclando español e inglés de manera natural y divertida.`;
                    break;
                case 'formal':
                    system += ` Mantén un tono más formal y profesional pero aún amigable.`;
                    break;
                case 'motivational':
                    system += ` Hazlo motivacional e inspirador, como si fueras un coach de desarrollo.`;
                    break;
                case 'pirate':
                    system += ` Escríbelo como si fueras un pirata, usando jerga pirata adaptada al desarrollo de software.`;
                    break;
            }
        }
    }

    const prompt = `Genera un mensaje. Datos:\n- Revisor: ${reviewer_name}\n- Solicitante: ${requester_name}\n- PR: ${pr}\nResponde en como mucho 2 líneas y máximo 280 caracteres. Devuélvelo como texto plano sin comillas. El mensaje generado debe ser de menos de 400 caracteres`;

    try {
        const { object } = await generateObject({
            schema: z.object({
                response: z.string().min(1).max(400),
            }),
            model: 'openai/gpt-5-nano',
            prompt: prompt,
            system: system,
        });
        const trimmed = object.response ? object.response.trim() : "";
        return {
            response: trimmed,
        }
    } catch (_e) {
        return { response: 'Error generando mensaje' };
    }
}
