import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const schema = z.object({
  VTON_PROVIDER: z.enum(["decart", "mock"]).default("mock"),
  DECART_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  DECART_MODEL: z.preprocess(emptyToUndefined, z.string().default("lucy-vton-latest")),
  DECART_SPEED: z.preprocess(emptyToUndefined, z.enum(["fast"]).optional()),
  MAX_SESSION_SECONDS: z.coerce.number().int().min(10).max(3600).default(30),
  FREE_SESSIONS_PER_DAY: z.coerce.number().int().min(0).max(10_000).default(3),
  TOKEN_ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  LLM_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai")),
  LLM_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  LLM_MODEL: z.preprocess(emptyToUndefined, z.string().default("gemini-2.5-flash")),
  FAL_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** When set, real (paid) sessions need this code: protects credits during demos. */
  DEMO_ACCESS_CODE: z.preprocess(emptyToUndefined, z.string().min(4).optional()),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Invalid environment configuration: " +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  cached = parsed.data;
  return cached;
}

/** The provider actually in effect: "decart" silently falls back to "mock" without a key. */
export function effectiveProvider(): "decart" | "mock" {
  const e = env();
  return e.VTON_PROVIDER === "decart" && e.DECART_API_KEY ? "decart" : "mock";
}

export function allowedOrigins(): string[] {
  return (env().TOKEN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Constant-time comparison of the demo access code. */
export function accessCodeOk(given: string | null): boolean {
  const want = env().DEMO_ACCESS_CODE;
  if (!want) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
