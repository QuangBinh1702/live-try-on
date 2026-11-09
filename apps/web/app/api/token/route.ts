import { NextResponse } from "next/server";
import { createDecartClient, resolveModelAlias } from "@decartai/sdk";
import { z } from "zod";
import { accessCodeOk, allowedOrigins, effectiveProvider, env } from "@/lib/server/env";
import { clientIp, hit } from "@/lib/server/rate-limit";
import { decideMint, rollbackMint } from "@/lib/server/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  const e = env();
  if (effectiveProvider() !== "decart") {
    return NextResponse.json({ error: "Server đang ở chế độ mock (chưa cấu hình DECART_API_KEY)" }, { status: 409 });
  }

  const ip = clientIp(req);
  if (!accessCodeOk(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "Cần mã truy cập hợp lệ để dùng AI thật" }, { status: 401 });
  }
  // Burst guard on top of the daily quota.
  if (!hit(`token-burst:${ip}`, 20, 60_000).ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu, thử lại sau ít phút" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "sessionId không hợp lệ" }, { status: 400 });

  const decision = decideMint(parsed.data.sessionId, ip, e.MAX_SESSION_SECONDS, e.FREE_SESSIONS_PER_DAY);
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status });

  try {
    const client = createDecartClient({ apiKey: e.DECART_API_KEY! });
    const canonical = (() => {
      try {
        return resolveModelAlias(e.DECART_MODEL as never) as string;
      } catch {
        return e.DECART_MODEL;
      }
    })();
    const origins = allowedOrigins();
    const token = await client.tokens.create({
      expiresIn: 60,
      allowedModels: Array.from(new Set([e.DECART_MODEL, canonical])),
      ...(origins.length ? { allowedOrigins: origins } : {}),
      constraints: { realtime: { maxSessionDuration: decision.secondsLeft } },
      metadata: { app: "live-tryon", session: parsed.data.sessionId },
    });
    return NextResponse.json(
      {
        apiKey: token.apiKey,
        expiresAt: token.expiresAt,
        secondsLeft: decision.secondsLeft,
        remainingToday: decision.remainingToday,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[token] mint failed", err);
    rollbackMint(parsed.data.sessionId, ip, decision.isNew);
    return NextResponse.json({ error: "Không tạo được token Decart" }, { status: 502 });
  }
}
