import "server-only";
import { z } from "zod";
import { env } from "./env";
import { CATEGORIES, PREPARE_SYSTEM_PROMPT, type Category } from "./prompts";

const resultSchema = z.object({
  item: z.string().max(80).catch("garment"),
  category: z.enum(CATEGORIES).catch("top"),
  supported: z.boolean().catch(true),
  reference_has_person: z.boolean().catch(false),
  multiple_items: z.boolean().catch(false),
  prompt: z.string().min(10).max(400),
});

export type GarmentAnalysis = {
  item: string;
  category: Category;
  supported: boolean;
  referenceHasPerson: boolean;
  multipleItems: boolean;
  prompt: string;
};

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("VLM did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * One call to any OpenAI-compatible chat endpoint (OpenAI, Gemini's OpenAI
 * endpoint, OpenRouter, a local vLLM...). Returns null when no key is configured.
 */
export async function analyzeGarment(
  garmentDataUri: string,
  personDataUri?: string,
): Promise<GarmentAnalysis | null> {
  const e = env();
  if (!e.LLM_API_KEY) return null;

  const content: unknown[] = [
    { type: "text", text: "Reference clothing image:" },
    { type: "image_url", image_url: { url: garmentDataUri, detail: "auto" } },
  ];
  if (personDataUri) {
    content.push(
      { type: "text", text: "Camera frame of the person:" },
      { type: "image_url", image_url: { url: personDataUri, detail: "low" } },
    );
  }

  const res = await fetch(`${e.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json", authorization: `Bearer ${e.LLM_API_KEY}` },
    body: JSON.stringify({
      model: e.LLM_MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: "system", content: PREPARE_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`VLM HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  const r = resultSchema.parse(extractJson(text));
  return {
    item: r.item,
    category: r.category,
    supported: r.supported && r.category !== "unsupported",
    referenceHasPerson: r.reference_has_person,
    multipleItems: r.multiple_items,
    prompt: r.prompt.trim(),
  };
}
