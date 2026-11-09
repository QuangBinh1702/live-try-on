import { FetchRejected, fetchImage } from "@/lib/server/safe-fetch";
import { clientIp, hit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/garment/fetch?url=https://shop.example/img.jpg → the image bytes (CORS-free for our page). */
export async function GET(req: Request) {
  if (!hit(`fetch:${clientIp(req)}`, 60, 60_000).ok) {
    return Response.json({ error: "Quá nhiều yêu cầu tải ảnh" }, { status: 429 });
  }
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return Response.json({ error: "Thiếu tham số url" }, { status: 400 });

  try {
    const img = await fetchImage(url);
    return new Response(img.bytes as BodyInit, {
      headers: {
        "content-type": img.contentType,
        "cache-control": "private, max-age=600",
        // Served bytes are untrusted: never let them execute or be sniffed as HTML.
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch (e) {
    if (e instanceof FetchRejected) return Response.json({ error: e.message }, { status: e.status });
    console.error("[garment/fetch]", e);
    return Response.json({ error: "Không tải được ảnh" }, { status: 502 });
  }
}
