"use client";

/** Downscale to fit `max` px on the long side; returns JPEG (or PNG when the source may have alpha). */
export async function normalizeImage(blob: Blob, max = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new Error("Không đọc được ảnh");
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const keepAlpha = blob.type === "image/png" || blob.type === "image/webp";
  if (!keepAlpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const type = keepAlpha ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Không mã hoá được ảnh"))), type, 0.92),
  );
}

/** Grab the current camera frame as a small JPEG (for the VLM to see what the person wears). */
export function captureFrame(video: HTMLVideoElement, max = 512): Promise<Blob | null> {
  if (!video.videoWidth) return Promise.resolve(null);
  const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}

/** Snapshot of the AI output video as a data URL (for the compare gallery). */
export function snapshot(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function fetchRemoteImage(url: string): Promise<Blob> {
  if (url.startsWith("data:image/")) return (await fetch(url)).blob();
  const res = await fetch(`/api/garment/fetch?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Không tải được ảnh");
  }
  return res.blob();
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

/** Pull an image (file or URL) out of a drop / paste event. */
export function imageFromTransfer(dt: DataTransfer | null): { file?: File; url?: string } | null {
  if (!dt) return null;
  const file = Array.from(dt.files).find((f) => f.type.startsWith("image/"));
  if (file) return { file };
  const html = dt.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    const src = img?.getAttribute("src");
    const srcset = img?.getAttribute("srcset");
    const best = srcset ? largestFromSrcset(srcset) : null;
    if (best || src) return { url: absolutize(best ?? src!) };
  }
  const uri = dt.getData("text/uri-list") || dt.getData("text/plain");
  const first = uri.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
  if (first && /^(https?:|data:image\/)/i.test(first.trim())) return { url: first.trim() };
  return null;
}

export function largestFromSrcset(srcset: string): string | null {
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = size?.endsWith("w") ? parseInt(size) : size?.endsWith("x") ? parseFloat(size) * 1000 : 1;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url ?? null;
}

function absolutize(u: string): string {
  if (u.startsWith("//")) return "https:" + u;
  return u;
}
