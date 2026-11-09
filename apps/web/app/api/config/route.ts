import { NextResponse } from "next/server";
import { effectiveProvider, env } from "@/lib/server/env";
import { clientIp, peek } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type PublicConfig = {
  provider: "decart" | "mock";
  model: string;
  speed: "fast" | null;
  maxSessionSeconds: number;
  freeSessionsPerDay: number;
  remainingToday: number;
  features: { llmPrompts: boolean; garmentExtraction: boolean };
  requiresAccessCode: boolean;
};

export async function GET(req: Request) {
  const e = env();
  const body: PublicConfig = {
    provider: effectiveProvider(),
    model: e.DECART_MODEL,
    speed: e.DECART_SPEED ?? null,
    maxSessionSeconds: e.MAX_SESSION_SECONDS,
    freeSessionsPerDay: e.FREE_SESSIONS_PER_DAY,
    remainingToday: peek(`day:${clientIp(req)}`, e.FREE_SESSIONS_PER_DAY).remaining,
    features: { llmPrompts: Boolean(e.LLM_API_KEY), garmentExtraction: Boolean(e.FAL_KEY) },
    requiresAccessCode: Boolean(e.DEMO_ACCESS_CODE),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
