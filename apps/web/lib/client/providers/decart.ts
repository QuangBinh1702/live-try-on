"use client";

import { createDecartClient, models } from "@decartai/sdk";
import type { PreflightResult, SessionCallbacks, TryOnProvider, TryOnSession } from "./types";

export class TokenError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const ACCESS_CODE_KEY = "live-tryon:access-code";

function storedAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

async function fetchToken(sessionId: string): Promise<string> {
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "content-type": "application/json", "x-access-code": storedAccessCode() },
    body: JSON.stringify({ sessionId }),
  });
  const json = (await res.json().catch(() => ({}))) as { apiKey?: string; error?: string };
  if (!res.ok || !json.apiKey) throw new TokenError(json.error ?? `Token HTTP ${res.status}`, res.status);
  return json.apiKey;
}

const SESSION_END_TEXT: Record<string, string> = {
  insufficient_credits: "Tài khoản Decart đã hết credit.",
  moderation_violation: "Phiên bị dừng do vi phạm chính sách nội dung.",
  policy_violation: "Phiên bị dừng do vi phạm chính sách.",
  session_limit: "Đã đạt giới hạn số phiên đồng thời, thử lại sau.",
};

export function createDecartProvider(opts: { model: string; speed: "fast" | null }): TryOnProvider {
  const model = models.realtime(opts.model as Parameters<typeof models.realtime>[0]);

  const clientFor = (sessionId: string) =>
    createDecartClient({ apiKeyProvider: () => fetchToken(sessionId), telemetry: false });

  return {
    name: "decart",

    async preflight(sessionId) {
      const report = await clientFor(sessionId).realtime.checkConnectivity({ model });
      return { quality: report.quality, reasons: report.reasons } satisfies PreflightResult;
    },

    async connect(stream, sessionId, cb: SessionCallbacks): Promise<TryOnSession> {
      cb.onStatus("connecting");
      const rt = await clientFor(sessionId).realtime.connect(stream, {
        model,
        mirror: "auto",
        ...(opts.speed ? { speed: opts.speed } : {}),
        onRemoteStream: cb.onRemoteStream,
        onConnectionChange: (s) => cb.onStatus(s),
        onConnectionQuality: (r) => cb.onQuality?.(r.quality, r.limitingFactor),
        onQueuePosition: (q) => {
          cb.onStatus("queued");
          cb.onQueue?.(q);
        },
        onCapacityWait: () => cb.onStatus("queued"),
      });
      cb.onQueue?.(null);
      let closedByUser = false;

      rt.on("generationTick", (t) => cb.onTick?.(t.seconds));
      rt.on("sessionEnded", (e) => cb.onEnded?.(SESSION_END_TEXT[e.reason] ?? `Phiên kết thúc (${e.reason}).`));
      rt.on("generationEnded", (e) => {
        if (!closedByUser) cb.onEnded?.(SESSION_END_TEXT[e.reason] ?? "Hết thời gian phiên.");
      });
      rt.on("error", (err) => cb.onError?.(err.message));

      return {
        setGarment: (image, prompt, enhance) => rt.setImage(image, { prompt, enhance }),
        setPrompt: (prompt, enhance) => rt.setPrompt(prompt, { enhance }),
        clearGarment: () => rt.setImage(null),
        disconnect: () => {
          closedByUser = true;
          rt.disconnect();
        },
      };
    },
  };
}
