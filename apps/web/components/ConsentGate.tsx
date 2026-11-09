"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

const KEY = "live-tryon:consent:v1";

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

/** 18+ confirmation and terms, before the camera is ever opened (decision D13). */
export function ConsentGate({ onAccept }: { onAccept: () => void }) {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-neutral-900 shadow-xl">
        <h2 className="text-xl font-semibold">Trước khi bật camera</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>Video camera được gửi trực tiếp tới máy chủ AI (Decart) để vẽ lại từng khung hình, chỉ trong thời gian phiên.</li>
          <li>Ứng dụng <b>không lưu</b> video của bạn trên máy chủ. Clip bạn ghi chỉ nằm trên máy bạn.</li>
          <li>Hãy coi như một cuộc gọi video: đừng để đồ riêng tư trong khung hình.</li>
          <li>Kết quả do AI tạo, không đánh giá được size.</li>
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          Tôi xác nhận mình đủ 18 tuổi.
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          Tôi đồng ý với <a className="underline" href="/terms" target="_blank">Điều khoản</a> và{" "}
          <a className="underline" href="/privacy" target="_blank">Chính sách quyền riêng tư</a>.
        </label>
        <button
          disabled={!adult || !terms}
          onClick={() => {
            try {
              localStorage.setItem(KEY, "yes");
            } catch {}
            onAccept();
          }}
          className="mt-5 w-full rounded-xl bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-40"
        >
          Bật camera và bắt đầu
        </button>
        <p className="mt-3 text-center text-xs text-neutral-400">{t.appName}</p>
      </div>
    </div>
  );
}
