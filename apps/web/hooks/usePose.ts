"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { TorsoBox } from "@/lib/client/providers/mock";

// Keep in sync with the exact version pinned in package.json.
const MEDIAPIPE_VERSION = "1.2.2";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const INTERVAL_MS = 400;
/** Consecutive empty detections before we say "nobody is here" (~3 s, as in Decart's example). */
const MISS_THRESHOLD = 8;

// BlazePose landmark indices
const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24, L_KNEE = 25, R_KNEE = 26;

export type BodyVisibility = { torso: boolean; hips: boolean; knees: boolean };

export type PoseState = {
  ready: boolean;
  failed: boolean;
  present: boolean;
  body: BodyVisibility;
};

type Lm = { x: number; y: number; visibility?: number };

const inFrame = (p: Lm | undefined) =>
  !!p && (p.visibility ?? 1) > 0.5 && p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.0;

export function usePose(video: HTMLVideoElement | null, enabled = true) {
  const [state, setState] = useState<PoseState>({
    ready: false,
    failed: false,
    present: false,
    body: { torso: false, hips: false, knees: false },
  });
  const landmarker = useRef<PoseLandmarker | null>(null);
  const torsoBox = useRef<TorsoBox>(null);
  const misses = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const create = (delegate: "GPU" | "CPU") =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        const lm = await create("GPU").catch(() => create("CPU"));
        if (cancelled) return lm.close();
        landmarker.current = lm;
        setState((s) => ({ ...s, ready: true }));
      } catch (e) {
        console.warn("[pose] MediaPipe unavailable, person detection disabled", e);
        if (!cancelled) setState((s) => ({ ...s, failed: true }));
      }
    })();
    return () => {
      cancelled = true;
      landmarker.current?.close();
      landmarker.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!state.ready || !video) return;
    const id = setInterval(() => {
      const lm = landmarker.current;
      if (!lm || video.readyState < 2 || !video.videoWidth) return;
      const res = lm.detectForVideo(video, performance.now());
      const pts = res.landmarks[0] as Lm[] | undefined;
      if (!pts) {
        misses.current += 1;
        if (misses.current >= MISS_THRESHOLD) {
          torsoBox.current = null;
          setState((s) => (s.present ? { ...s, present: false, body: { torso: false, hips: false, knees: false } } : s));
        }
        return;
      }
      misses.current = 0;
      const body: BodyVisibility = {
        torso: inFrame(pts[L_SHOULDER]) || inFrame(pts[R_SHOULDER]),
        hips: inFrame(pts[L_HIP]) || inFrame(pts[R_HIP]),
        knees: inFrame(pts[L_KNEE]) || inFrame(pts[R_KNEE]),
      };
      const ls = pts[L_SHOULDER]!, rs = pts[R_SHOULDER]!, lh = pts[L_HIP]!, rh = pts[R_HIP]!;
      const x0 = Math.min(ls.x, rs.x), x1 = Math.max(ls.x, rs.x);
      const y0 = Math.min(ls.y, rs.y), y1 = Math.max(lh.y, rh.y, y0 + 0.2);
      const padX = (x1 - x0) * 0.25;
      torsoBox.current = { x: x0 - padX, y: y0 - 0.04, w: x1 - x0 + 2 * padX, h: Math.min(1, y1) - y0 + 0.08 };
      setState((s) =>
        s.present && s.body.torso === body.torso && s.body.hips === body.hips && s.body.knees === body.knees
          ? s
          : { ...s, present: true, body },
      );
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.ready, video]);

  return { ...state, getTorsoBox: () => torsoBox.current };
}
