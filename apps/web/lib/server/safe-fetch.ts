import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent } from "undici";

/**
 * Fetch a remote image on behalf of the browser (shops do not send CORS headers)
 * without turning the server into an SSRF proxy:
 *  - http/https only, default ports only
 *  - every resolved address is checked at connect time (defeats DNS rebinding)
 *  - redirects followed manually (max 3) and re-validated
 *  - size, time and content-type limits
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class FetchRejected extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base!) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15",
  "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

export function isBlockedAddress(address: string): boolean {
  let ip = address.toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  // IPv4-mapped IPv6 (::ffff:10.0.0.1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1]!;
  if (net.isIPv4(ip)) return BLOCKED_V4.some((c) => inV4(ip, c));
  if (net.isIPv6(ip)) {
    if (ip === "::" || ip === "::1") return true;
    const first = parseInt(ip.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (ip.startsWith("64:ff9b:")) return true; // NAT64 can reach v4 internals
    return false;
  }
  return true; // not an IP at all: refuse
}

function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      const e = new Error(`Blocked address for ${hostname}`) as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return callback(e, "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as never, timeout: TIMEOUT_MS },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

export function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRejected("URL không hợp lệ");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchRejected("Chỉ hỗ trợ http/https");
  }
  if (url.username || url.password) throw new FetchRejected("URL không được chứa thông tin đăng nhập");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchRejected("Cổng không được phép");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) throw new FetchRejected("Địa chỉ không được phép");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new FetchRejected("Địa chỉ không được phép");
  return url;
}

export type FetchedImage = { bytes: Uint8Array; contentType: string };

export async function fetchImage(rawUrl: string): Promise<FetchedImage> {
  let url = validateUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "user-agent": "LiveTryOn/0.1 (+image fetch for virtual try-on)",
      },
      // @ts-expect-error undici dispatcher is supported by Node's fetch
      dispatcher: agent,
    }).catch((e: unknown) => {
      const msg = e instanceof Error && /EBLOCKED/.test(String((e as { cause?: unknown }).cause ?? e.message))
        ? "Địa chỉ không được phép"
        : "Không tải được ảnh";
      throw new FetchRejected(msg, 502);
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FetchRejected("Chuyển hướng không hợp lệ", 502);
      url = validateUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new FetchRejected(`Nguồn ảnh trả về ${res.status}`, 502);

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      throw new FetchRejected("Liên kết không phải ảnh (jpg/png/webp/avif)", 415);
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) throw new FetchRejected("Ảnh quá lớn (tối đa 8 MB)", 413);

    const reader = res.body?.getReader();
    if (!reader) throw new FetchRejected("Ảnh rỗng", 502);
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new FetchRejected("Ảnh quá lớn (tối đa 8 MB)", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.byteLength;
    }
    return { bytes, contentType };
  }
  throw new FetchRejected("Quá nhiều lần chuyển hướng", 502);
}
