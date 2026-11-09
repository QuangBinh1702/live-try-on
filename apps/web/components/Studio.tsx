"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicConfig } from "@/app/api/config/route";
import type { PrepareResponse } from "@/app/api/garment/prepare/route";
import { useCamera } from "@/hooks/useCamera";
import { usePose } from "@/hooks/usePose";
import { useRecorder } from "@/hooks/useRecorder";
import { captureFrame, dataUrlToBlob, fetchRemoteImage, imageFromTransfer, normalizeImage, snapshot } from "@/lib/client/images";
import { ACCESS_CODE_KEY, createDecartProvider } from "@/lib/client/providers/decart";
import { createMockProvider } from "@/lib/client/providers/mock";
import type { NetQuality, SessionStatus, TryOnProvider, TryOnSession } from "@/lib/client/providers/types";
import { t } from "@/lib/i18n";
import { CompareModal, type Shot } from "./CompareModal";
import { ConsentGate, hasConsent } from "./ConsentGate";

type Garment = {
  id: string;
  thumb: string; // object URL of the image actually sent to the model
  image: Blob;
  prompt: string;
  enhance: boolean;
  item: string | null;
  category: PrepareResponse["category"];
  sourceUrl?: string;
};

const uuid = () => crypto.randomUUID();

export default function Studio({ initialGarmentUrl }: { initialGarmentUrl?: string }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [consented, setConsented] = useState(false);
  const camera = useCamera();
  const recorder = useRecorder();

  const rawVideo = useRef<HTMLVideoElement>(null);
  const outVideo = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [rawEl, setRawEl] = useState<HTMLVideoElement | null>(null);

  const pose = usePose(rawEl, consented);

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [quality, setQuality] = useState<NetQuality | null>(null);
  const [queue, setQueue] = useState<{ position: number; queueSize: number } | null>(null);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [history, setHistory] = useState<Garment[]>([]);
  const [current, setCurrent] = useState<Garment | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShots, setSelectedShots] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [showRaw, setShowRaw] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  const session = useRef<TryOnSession | null>(null);
  const sessionId = useRef<string>(uuid());
  const currentRef = useRef<Garment | null>(null);
  currentRef.current = current;
  const connecting = useRef(false);
  /** A garment arrived before the camera/provider was ready: connect as soon as they are. */
  const [pendingStart, setPendingStart] = useState(false);

  // ── config + consent ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Không tải được cấu hình máy chủ"));
    setConsented(hasConsent());
    try {
      setAccessCode(localStorage.getItem(ACCESS_CODE_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (consented && !camera.stream) void camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consented]);

  useEffect(() => {
    const v = rawVideo.current;
    if (v && camera.stream) {
      v.srcObject = camera.stream;
      void v.play().catch(() => undefined);
      setRawEl(v);
    }
  }, [camera.stream]);

  useEffect(() => {
    const v = outVideo.current;
    if (v) {
      v.srcObject = remoteStream;
      if (remoteStream) void v.play().catch(() => undefined);
    }
  }, [remoteStream]);

  const provider: TryOnProvider | null = useMemo(() => {
    if (!config) return null;
    return config.provider === "decart"
      ? createDecartProvider({ model: config.model, speed: config.speed })
      : createMockProvider({ maxSessionSeconds: config.maxSessionSeconds, getTorsoBox: pose.getTorsoBox });
    // getTorsoBox reads a ref, so it is stable enough for the mock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ── session lifecycle ──────────────────────────────────────────────────
  const stopRecording = recorder.stop;
  const disconnect = useCallback(() => {
    stopRecording();
    session.current?.disconnect();
    session.current = null;
    setRemoteStream(null);
    setQuality(null);
    setQueue(null);
  }, [stopRecording]);

  const connect = useCallback(async (): Promise<TryOnSession | null> => {
    if (session.current) return session.current;
    if (!provider || !camera.stream || connecting.current) return null;
    connecting.current = true;
    setError(null);
    setNotice(null);
    setEnded(false);
    try {
      setStatus("preflight");
      const pre = await provider.preflight(sessionId.current).catch(() => null);
      if (pre?.quality === "critical") {
        setNotice(`Mạng rất yếu (${pre.reasons.join(", ") || "độ trễ cao"}), hình có thể bị giật.`);
      } else if (pre?.quality === "poor") {
        setNotice("Mạng yếu, hình có thể bị giật.");
      }
      const s = await provider.connect(camera.stream, sessionId.current, {
        onRemoteStream: setRemoteStream,
        onStatus: setStatus,
        onQuality: (q) => setQuality(q),
        onQueue: setQueue,
        onTick: setUsedSeconds,
        onEnded: (reason) => {
          setNotice(reason);
          setEnded(true);
          session.current = null;
          setRemoteStream(null);
          setStatus("disconnected");
          stopRecording();
        },
        onError: (m) => setError(m),
      });
      session.current = s;
      // Re-apply the garment after a reconnect (person came back, network blip...).
      const g = currentRef.current;
      if (g) await s.setGarment(g.image, g.prompt, g.enhance).catch(() => undefined);
      return s;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Kết nối thất bại");
      return null;
    } finally {
      connecting.current = false;
    }
  }, [provider, camera.stream, stopRecording]);

  const newSession = useCallback(() => {
    disconnect();
    sessionId.current = uuid();
    setUsedSeconds(0);
    setEnded(false);
    setNotice(null);
    setStatus("idle");
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => undefined);
  }, [disconnect]);

  useEffect(() => {
    if (pendingStart && camera.stream && provider && consented && !session.current && !ended) {
      setPendingStart(false);
      void connect();
    }
  }, [pendingStart, camera.stream, provider, consented, ended, connect]);

  // Pause when nobody is in frame (saves credits), resume when they return.
  useEffect(() => {
    if (!pose.ready || ended) return;
    if (!pose.present && session.current) {
      disconnect();
      setPaused(true);
      setStatus("idle");
    } else if (pose.present && paused && !session.current) {
      setPaused(false);
      void connect();
    }
  }, [pose.present, pose.ready, paused, ended, connect, disconnect]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  useEffect(() => () => disconnectRef.current(), []);

  // ── garments ───────────────────────────────────────────────────────────
  const applyGarment = useCallback(
    async (input: Blob, sourceUrl?: string) => {
      if (ended) {
        setNotice("Phiên đã hết thời gian. Bấm “Phiên mới” để tiếp tục.");
        return;
      }
      setError(null);
      setWarnings([]);
      const t0 = performance.now();
      try {
        setBusy("Đang chuẩn bị ảnh…");
        const img = await normalizeImage(input);
        const fd = new FormData();
        fd.append("garment", img, "garment");
        const frame = rawVideo.current ? await captureFrame(rawVideo.current) : null;
        if (frame) fd.append("personFrame", frame, "frame.jpg");
        setBusy(config?.features.llmPrompts ? "AI đang phân tích món đồ…" : "Đang chuẩn bị…");
        const res = await fetch("/api/garment/prepare", { method: "POST", body: fd });
        const prep = (await res.json()) as PrepareResponse & { error?: string };
        if (!res.ok) throw new Error(prep.error ?? "Không chuẩn bị được ảnh");
        setWarnings(prep.warnings);
        if (!prep.supported) return;

        const finalImage = prep.extractedImage ? await dataUrlToBlob(prep.extractedImage) : img;
        const g: Garment = {
          id: uuid(),
          thumb: URL.createObjectURL(finalImage),
          image: finalImage,
          prompt: prep.prompt,
          enhance: prep.source === "fallback",
          item: prep.item,
          category: prep.category,
          sourceUrl,
        };
        setCurrent(g);
        setPromptDraft(g.prompt);
        setHistory((h) => [g, ...h.filter((x) => x.sourceUrl !== sourceUrl || !sourceUrl)].slice(0, 24));

        setBusy("Đang mặc thử…");
        const s = session.current ?? (await connect());
        if (!s) {
          setPendingStart(true);
          return;
        }
        await s.setGarment(g.image, g.prompt, g.enhance);
        setLastLatencyMs(Math.round(performance.now() - t0));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      } finally {
        setBusy(null);
      }
    },
    [config, connect, ended],
  );

  const applyFromUrl = useCallback(
    async (url: string) => {
      try {
        setBusy("Đang tải ảnh…");
        const blob = await fetchRemoteImage(url);
        await applyGarment(blob, url);
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "Không tải được ảnh");
      }
    },
    [applyGarment],
  );

  const reapply = useCallback(
    async (g: Garment) => {
      setCurrent(g);
      setPromptDraft(g.prompt);
      const s = session.current ?? (await connect());
      await s?.setGarment(g.image, g.prompt, g.enhance).catch((e) => setError(String(e)));
    },
    [connect],
  );

  // First garment passed by URL (?garment=...) or by the extension.
  const initialDone = useRef(false);
  useEffect(() => {
    if (!initialGarmentUrl || initialDone.current || !camera.stream || !config) return;
    initialDone.current = true;
    void applyFromUrl(initialGarmentUrl);
  }, [initialGarmentUrl, camera.stream, config, applyFromUrl]);

  // Bridge from the Chrome extension (content script → window.postMessage).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as { source?: string; type?: string; url?: string };
      if (d?.source === "live-tryon-ext" && d.type === "garment" && typeof d.url === "string") void applyFromUrl(d.url);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "live-tryon-app", type: "ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, [applyFromUrl]);

  // Paste an image or an image URL anywhere.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      const got = imageFromTransfer(e.clipboardData);
      if (got?.file) void applyGarment(got.file);
      else if (got?.url) void applyFromUrl(got.url);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyGarment, applyFromUrl]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const got = imageFromTransfer(e.dataTransfer);
    if (got?.file) void applyGarment(got.file);
    else if (got?.url) void applyFromUrl(got.url);
    else setError("Không nhận được ảnh. Hãy kéo trực tiếp tấm ảnh sản phẩm.");
  };

  // ── extras ─────────────────────────────────────────────────────────────
  const takeShot = () => {
    const v = outVideo.current;
    const url = v && snapshot(v);
    if (!url) return;
    const label = current?.item ?? `Ảnh ${shots.length + 1}`;
    setShots((s) => [{ id: uuid(), dataUrl: url, label, at: Date.now() }, ...s].slice(0, 12));
  };
  const toggleShot = (id: string) =>
    setSelectedShots((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].slice(-3)));
  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const framingHint = (() => {
    if (!pose.ready || !camera.stream) return null;
    if (!pose.present) return t.framing.nobody;
    const c = current?.category;
    if ((c === "top" || c === "outerwear") && !pose.body.torso) return t.framing.torso;
    if (c === "bottom" && !pose.body.hips) return t.framing.hips;
    if (c === "full_body" && !pose.body.knees) return t.framing.knees;
    return null;
  })();

  const secondsLeft = config ? Math.max(0, config.maxSessionSeconds - usedSeconds) : null;
  const live = !!session.current && !!remoteStream;

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:flex-row">
      {!consented && <ConsentGate onAccept={() => setConsented(true)} />}
      {comparing && (
        <CompareModal shots={shots.filter((s) => selectedShots.includes(s.id))} onClose={() => setComparing(false)} />
      )}

      {/* Stage */}
      <section className="flex-1">
        <div
          ref={stageRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900 ring-2 ${dragOver ? "ring-emerald-400" : "ring-transparent"}`}
        >
          {/* AI output */}
          <video ref={outVideo} playsInline muted className={`absolute inset-0 h-full w-full object-contain ${live ? "" : "hidden"}`} />
          {/* Raw camera: full stage before connecting, picture-in-picture afterwards */}
          <video
            ref={rawVideo}
            playsInline
            muted
            className={
              live
                ? `absolute bottom-3 right-3 w-1/4 -scale-x-100 rounded-lg border border-white/30 object-cover shadow-lg ${showRaw ? "" : "hidden"}`
                : "absolute inset-0 h-full w-full -scale-x-100 object-contain"
            }
          />

          <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-white">
              {config?.provider === "mock" ? "MOCK · " : ""}
              {t.status[status]}
              {queue ? ` (#${queue.position}/${queue.queueSize})` : ""}
            </span>
            {quality && (
              <span className={`rounded-full px-2.5 py-1 text-white ${quality === "good" || quality === "fair" ? "bg-emerald-600/80" : "bg-amber-600/80"}`}>
                {t.quality[quality]}
              </span>
            )}
            {live && secondsLeft !== null && (
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-white">Còn {secondsLeft}s</span>
            )}
            {recorder.recording && <span className="rounded-full bg-red-600 px-2.5 py-1 text-white">● REC</span>}
          </div>

          {(busy || framingHint || (dragOver && "Thả ảnh để mặc thử")) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white">
                {dragOver ? "Thả ảnh để mặc thử" : busy ?? framingHint}
              </span>
            </div>
          )}

          {!camera.stream && consented && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
              {camera.error ?? "Đang mở camera…"}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!session.current ? (
            ended ? (
              <button onClick={newSession} className="btn-primary">Phiên mới</button>
            ) : (
              <button onClick={() => void connect()} disabled={!camera.stream || !provider} className="btn-primary">
                {paused ? "Tiếp tục" : "Bắt đầu thử đồ"}
              </button>
            )
          ) : (
            <button onClick={() => { disconnect(); setStatus("idle"); }} className="btn">Dừng</button>
          )}
          <button onClick={takeShot} disabled={!live} className="btn">📸 Chụp</button>
          {recorder.recording ? (
            <button onClick={recorder.stop} className="btn">■ Dừng ghi</button>
          ) : (
            <button onClick={() => recorder.start(remoteStream)} disabled={!live} className="btn">● Ghi clip</button>
          )}
          {recorder.clipUrl && (
            <a href={recorder.clipUrl} download={`try-on-${Date.now()}.webm`} className="btn">⬇ Tải clip</a>
          )}
          <button onClick={() => setShowRaw((v) => !v)} disabled={!live} className="btn">
            {showRaw ? "Ẩn" : "Hiện"} camera gốc
          </button>
          <button onClick={toggleFullscreen} className="btn">⛶ Toàn màn hình</button>
          <button
            onClick={() => void camera.start(camera.facing === "user" ? "environment" : "user").then(() => disconnect())}
            className="btn"
          >
            ↺ Đổi camera
          </button>
          <span className="ml-auto text-xs text-neutral-500">
            {config && `Lượt miễn phí hôm nay: ${config.remainingToday}/${config.freeSessionsPerDay} · ${config.maxSessionSeconds}s/phiên`}
            {lastLatencyMs !== null && ` · Phản hồi gần nhất: ${(lastLatencyMs / 1000).toFixed(1)}s`}
          </span>
        </div>

        {config?.provider === "mock" && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <b>Đang ở chế độ MOCK:</b> chỉ dán ảnh quần áo lên người để test giao diện, <b>không phải AI</b>. Để dùng AI thật
            (giống Anywear), điền <code>VTON_PROVIDER=decart</code> và <code>DECART_API_KEY</code> trong{" "}
            <code>apps/web/.env.local</code> rồi chạy lại <code>npm run dev</code>.
          </p>
        )}

        {(error || notice || warnings.length > 0) && (
          <div className="mt-3 space-y-1 text-sm">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
            {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{notice}</p>}
            {warnings.map((w) => (
              <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{w}</p>
            ))}
          </div>
        )}

        {current && (
          <div className="mt-3 rounded-xl border border-neutral-200 p-3">
            <label className="text-xs font-medium text-neutral-500">Prompt gửi cho AI (có thể sửa)</label>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded-lg border border-neutral-200 p-2 text-sm"
            />
            <div className="mt-1 flex justify-end">
              <button
                className="btn"
                disabled={!promptDraft.trim() || promptDraft === current.prompt}
                onClick={() => {
                  const g = { ...current, prompt: promptDraft.trim(), enhance: false };
                  setHistory((h) => h.map((x) => (x.id === g.id ? g : x)));
                  void reapply(g);
                }}
              >
                Áp dụng prompt
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Side panel */}
      <aside className="w-full space-y-4 lg:w-80">
        {config?.requiresAccessCode && config.provider === "decart" && (
          <div className="rounded-xl border border-neutral-200 p-3">
            <label className="text-xs font-medium text-neutral-500">Mã truy cập (bản demo dùng AI thật)</label>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                try {
                  localStorage.setItem(ACCESS_CODE_KEY, e.target.value);
                } catch {}
              }}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              placeholder="Nhập mã do ban tổ chức/nhóm cung cấp"
            />
          </div>
        )}

        <div className="rounded-xl border border-dashed border-neutral-300 p-3">
          <p className="text-sm text-neutral-600">{t.drop}</p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (urlInput.trim()) void applyFromUrl(urlInput.trim());
              setUrlInput("");
            }}
          >
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…/ao.jpg"
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
            <button className="btn">Thử</button>
          </form>
          <label className="btn mt-2 inline-block cursor-pointer">
            Chọn ảnh từ máy
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void applyGarment(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Đã thử ({history.length})</h3>
          {history.length === 0 ? (
            <p className="text-xs text-neutral-500">Chưa có món nào. Kéo ảnh từ trang shop vào khung camera.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {history.map((g) => (
                <button
                  key={g.id}
                  title={g.item ?? ""}
                  onClick={() => void reapply(g)}
                  className={`aspect-square overflow-hidden rounded-lg border bg-white ${current?.id === g.id ? "border-neutral-900" : "border-neutral-200"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.thumb} alt={g.item ?? "garment"} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ảnh chụp ({shots.length})</h3>
            <button className="btn" disabled={selectedShots.length < 2} onClick={() => setComparing(true)}>
              So sánh ({selectedShots.length})
            </button>
          </div>
          {shots.length === 0 ? (
            <p className="text-xs text-neutral-500">Bấm 📸 khi đang mặc thử, rồi chọn 2–3 ảnh để so sánh cạnh nhau.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {shots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleShot(s.id)}
                  className={`overflow-hidden rounded-lg border-2 ${selectedShots.includes(s.id) ? "border-emerald-500" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.dataUrl} alt={s.label} className="aspect-video w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="space-y-1 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
          {t.tips.map((tip) => (
            <li key={tip}>• {tip}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
