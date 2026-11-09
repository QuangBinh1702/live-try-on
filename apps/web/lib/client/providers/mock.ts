"use client";

import type { SessionCallbacks, TryOnProvider, TryOnSession } from "./types";

export type TorsoBox = { x: number; y: number; w: number; h: number } | null;

/**
 * Free stand-in for the real model so the whole UI can be developed and demoed
 * without credits: it paints the garment over the torso (from MediaPipe pose when
 * available) on a canvas and exposes it as a MediaStream, with the same latency,
 * tick and time-limit behaviour as a real session.
 */
export function createMockProvider(opts: {
  maxSessionSeconds: number;
  getTorsoBox?: () => TorsoBox;
}): TryOnProvider {
  return {
    name: "mock",
    async preflight() {
      return { quality: "good", reasons: [] };
    },
    async connect(stream, _sessionId, cb: SessionCallbacks): Promise<TryOnSession> {
      cb.onStatus("connecting");
      await new Promise((r) => setTimeout(r, 600));

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;
      let garment: HTMLImageElement | null = null;
      let label = "";
      let raf = 0;
      let stopped = false;

      const draw = () => {
        if (stopped) return;
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }
        ctx.save();
        ctx.translate(vw, 0);
        ctx.scale(-1, 1); // mirror like the real model with mirror:"auto"
        ctx.drawImage(video, 0, 0, vw, vh);
        ctx.restore();

        if (garment) {
          const box = opts.getTorsoBox?.() ?? { x: 0.3, y: 0.3, w: 0.4, h: 0.45 };
          // Landmarks are in un-mirrored coordinates: flip x.
          const w = box.w * vw;
          const h = box.h * vh;
          const x = (1 - box.x - box.w) * vw;
          const y = box.y * vh;
          const ratio = garment.naturalWidth / Math.max(1, garment.naturalHeight);
          const dw = Math.min(w, h * ratio);
          const dh = dw / ratio;
          ctx.globalAlpha = 0.88;
          ctx.drawImage(garment, x + (w - dw) / 2, y, dw, dh);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(12, vh - 46, 360, 34);
        ctx.fillStyle = "#fff";
        ctx.font = "16px system-ui, sans-serif";
        ctx.fillText(`MOCK – không phải AI thật${label ? " · " + label : ""}`.slice(0, 48), 22, vh - 23);
        raf = requestAnimationFrame(draw);
      };
      draw();

      const out = canvas.captureStream(30);
      cb.onRemoteStream(out);
      cb.onStatus("connected");
      cb.onQuality?.("good");

      let seconds = 0;
      const tick = setInterval(() => {
        seconds += 1;
        cb.onTick?.(seconds);
        if (seconds >= opts.maxSessionSeconds) {
          cb.onEnded?.("Hết thời gian phiên (mock).");
          stop();
        }
      }, 1000);

      function stop() {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(raf);
        clearInterval(tick);
        out.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        cb.onStatus("disconnected");
      }

      return {
        async setGarment(image, prompt) {
          cb.onStatus("generating");
          const url = URL.createObjectURL(image);
          const img = new Image();
          img.src = url;
          await img.decode().catch(() => undefined);
          await new Promise((r) => setTimeout(r, 1200)); // roughly the real time-to-first-garment
          garment = img;
          label = prompt.split(" with ")[1]?.slice(0, 24) ?? "";
          cb.onStatus("connected");
        },
        async setPrompt(prompt) {
          label = prompt.slice(0, 24);
        },
        async clearGarment() {
          garment = null;
          label = "";
        },
        disconnect: stop,
      };
    },
  };
}
