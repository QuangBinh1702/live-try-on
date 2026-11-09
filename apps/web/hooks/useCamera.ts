"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Facing = "user" | "environment";

/** Camera at the model's native format (1280x720 @ 30 fps for lucy-vton). */
export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(
    async (want: Facing = facing) => {
      setError(null);
      stop();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: want, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        });
        streamRef.current = s;
        setStream(s);
        setFacing(want);
        return s;
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "Bạn chưa cho phép dùng camera. Bấm biểu tượng ổ khoá trên thanh địa chỉ để cấp quyền rồi tải lại trang."
            : name === "NotReadableError"
              ? "Camera đang bị ứng dụng khác dùng (Zoom, Meet, OBS...). Hãy đóng ứng dụng đó."
              : name === "NotFoundError"
                ? "Không tìm thấy camera."
                : !window.isSecureContext
                  ? "Camera chỉ chạy trên HTTPS hoặc localhost."
                  : "Không mở được camera.",
        );
        return null;
      }
    },
    [facing, stop],
  );

  useEffect(() => stop, [stop]);

  return { stream, error, facing, start, stop };
}
