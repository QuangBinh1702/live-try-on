import "server-only";
import { fal } from "@fal-ai/client";
import { env } from "./env";
import { EXTRACT_GARMENT_PROMPT } from "./prompts";
import { fetchImage } from "./safe-fetch";

let configured = false;

/**
 * Removes the model/person from a product photo and returns the garment on white,
 * using fal's FLUX.2 Klein 4B edit model (same choice as Decart's full-featured example).
 * Returns null when FAL_KEY is not set.
 */
export async function extractGarment(image: Blob): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const key = env().FAL_KEY;
  if (!key) return null;
  if (!configured) {
    fal.config({ credentials: key });
    configured = true;
  }
  const uploadedUrl = await fal.storage.upload(image);
  const result = await fal.subscribe("fal-ai/flux-2/klein/4b/base/edit", {
    input: { prompt: EXTRACT_GARMENT_PROMPT, image_urls: [uploadedUrl] },
  });
  const outUrl = (result.data as { images?: { url: string }[] }).images?.[0]?.url;
  if (!outUrl) throw new Error("fal returned no image");
  // Output lives on fal's CDN; fetch through the same guarded fetcher.
  return fetchImage(outUrl);
}
