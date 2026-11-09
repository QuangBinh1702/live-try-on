import { NextResponse } from "next/server";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { analyzeGarment, type GarmentAnalysis } from "@/lib/server/vlm";
import { extractGarment } from "@/lib/server/extract";
import { fallbackPrompt, type Category } from "@/lib/server/prompts";
import { MAX_IMAGE_BYTES } from "@/lib/server/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type PrepareResponse = {
  prompt: string;
  category: Category | null;
  item: string | null;
  supported: boolean;
  /** Short user-facing warnings (Vietnamese). */
  warnings: string[];
  /** data: URL of the garment isolated on white, when extraction ran. */
  extractedImage: string | null;
  source: "vlm" | "fallback";
  timings: { vlmMs: number; extractMs: number };
};

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

async function toDataUri(file: Blob): Promise<string> {
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${file.type || "image/jpeg"};base64,${b64}`;
}

export async function POST(req: Request) {
  if (!hit(`prepare:${clientIp(req)}`, 30, 60_000).ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu, thử lại sau ít phút" }, { status: 429 });
  }
  const form = await req.formData().catch(() => null);
  const garment = form?.get("garment");
  const person = form?.get("personFrame");
  const extractMode = form?.get("extract") === "off" ? "off" : "auto";

  if (!(garment instanceof Blob) || garment.size === 0) {
    return NextResponse.json({ error: "Thiếu ảnh quần áo" }, { status: 400 });
  }
  if (garment.size > MAX_IMAGE_BYTES || !ALLOWED.has(garment.type)) {
    return NextResponse.json({ error: "Ảnh phải là JPG/PNG/WebP/AVIF, tối đa 8 MB" }, { status: 415 });
  }
  const personBlob = person instanceof Blob && person.size > 0 && person.size < 3_000_000 && ALLOWED.has(person.type)
    ? person
    : undefined;

  const warnings: string[] = [];
  let analysis: GarmentAnalysis | null = null;
  const t0 = Date.now();
  try {
    analysis = await analyzeGarment(await toDataUri(garment), personBlob ? await toDataUri(personBlob) : undefined);
  } catch (e) {
    console.error("[prepare] VLM failed, using fallback prompt", e);
    warnings.push("Không phân tích được ảnh bằng AI, dùng prompt mặc định.");
  }
  const vlmMs = Date.now() - t0;

  let extractedImage: string | null = null;
  let extractMs = 0;
  if (analysis?.referenceHasPerson && extractMode === "auto") {
    const t1 = Date.now();
    try {
      const out = await extractGarment(garment);
      if (out) {
        extractedImage = `data:${out.contentType};base64,${Buffer.from(out.bytes).toString("base64")}`;
      } else {
        warnings.push("Ảnh có người mẫu. Bật FAL_KEY để tự tách quần áo, hoặc dùng ảnh chỉ có món đồ để kết quả chính xác hơn.");
      }
    } catch (e) {
      console.error("[prepare] extraction failed", e);
      warnings.push("Tách quần áo khỏi ảnh người mẫu thất bại, dùng ảnh gốc.");
    }
    extractMs = Date.now() - t1;
  }

  if (analysis?.multipleItems) warnings.push("Ảnh có nhiều món, AI có thể chọn nhầm. Nên dùng ảnh một món duy nhất.");
  if (analysis && !analysis.supported) warnings.push(`"${analysis.item}" hiện chưa được hỗ trợ (túi, trang sức, đồng hồ, thắt lưng...).`);

  const body: PrepareResponse = {
    prompt: analysis?.prompt ?? fallbackPrompt(undefined),
    category: analysis?.category ?? null,
    item: analysis?.item ?? null,
    supported: analysis?.supported ?? true,
    warnings,
    extractedImage,
    source: analysis ? "vlm" : "fallback",
    timings: { vlmMs, extractMs },
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
