import "server-only";
import { DAY_MS, hit, peek, undo } from "./rate-limit";

/**
 * A "try-on session" is one camera session in the studio. The SDK asks for a fresh
 * token on every connect AND reconnect, so we track sessions by a client-generated id:
 *  - the first token for a new id consumes one daily free session,
 *  - later tokens for the same id (reconnects) are free but only get the time that is left,
 *    so reconnecting can never extend a session beyond MAX_SESSION_SECONDS.
 */
type Session = { ip: string; startedAt: number; mints: number };

const sessions = new Map<string, Session>();
const MAX_MINTS_PER_SESSION = 8;

function gc(now: number, maxSeconds: number) {
  for (const [id, s] of sessions) {
    if (now - s.startedAt > (maxSeconds + 300) * 1000) sessions.delete(id);
  }
}

export type MintDecision =
  | { ok: true; secondsLeft: number; remainingToday: number; isNew: boolean }
  | { ok: false; status: number; error: string };

export function decideMint(
  sessionId: string,
  ip: string,
  maxSeconds: number,
  perDay: number,
): MintDecision {
  const now = Date.now();
  gc(now, maxSeconds);
  const existing = sessions.get(sessionId);

  if (existing) {
    if (existing.ip !== ip) return { ok: false, status: 403, error: "Phiên không thuộc thiết bị này" };
    if (existing.mints >= MAX_MINTS_PER_SESSION) {
      return { ok: false, status: 429, error: "Kết nối lại quá nhiều lần, hãy bắt đầu phiên mới" };
    }
    const secondsLeft = Math.floor(maxSeconds - (now - existing.startedAt) / 1000);
    if (secondsLeft < 5) return { ok: false, status: 410, error: "Phiên đã hết thời gian" };
    existing.mints += 1;
    return { ok: true, secondsLeft, remainingToday: peek(`day:${ip}`, perDay).remaining, isNew: false };
  }

  const day = hit(`day:${ip}`, perDay, DAY_MS);
  if (!day.ok) {
    const hours = Math.ceil((day.resetAt - now) / 3_600_000);
    return { ok: false, status: 429, error: `Bạn đã dùng hết lượt miễn phí hôm nay. Thử lại sau khoảng ${hours} giờ.` };
  }
  sessions.set(sessionId, { ip, startedAt: now, mints: 1 });
  return { ok: true, secondsLeft: maxSeconds, remainingToday: day.remaining, isNew: true };
}

/** Undo a mint that failed upstream so the user is not charged a free session for it. */
export function rollbackMint(sessionId: string, ip: string, isNew: boolean) {
  const s = sessions.get(sessionId);
  if (!s) return;
  if (isNew) {
    sessions.delete(sessionId);
    undo(`day:${ip}`);
  } else if (s.mints > 0) {
    s.mints -= 1;
  }
}
