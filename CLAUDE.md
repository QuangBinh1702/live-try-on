# CLAUDE.md: hướng dẫn cho Claude Code trong repo này

Dự án: **Live Try-On**, thử đồ ảo trực tiếp qua camera (làm lại Anywear). Đọc `PLAN.md` trước khi làm, đặc biệt mục 0 (quyết định cần chốt) và mục 4 (lộ trình).

## Cấu trúc
- `apps/web`: Next.js 16 App Router, React 19, TS strict, Tailwind 4. Next 16 có thay đổi so với bản cũ, xem `apps/web/AGENTS.md`.
  - `lib/server/*`: chỉ chạy server (`import "server-only"`). Env validate bằng zod trong `env.ts`.
  - `lib/client/providers/*`: lớp provider realtime (`decart`, `mock`). UI chỉ nói chuyện qua interface `TryOnProvider`.
  - `components/Studio.tsx`: màn hình thử đồ chính.
- `apps/extension`: Chrome MV3, JS thuần. Không dùng inline script (CSP của MV3).

## Quy tắc
- Chuỗi hiển thị cho người dùng: tiếng Việt, gom vào `lib/i18n.ts` khi thêm mới.
- Không bao giờ đưa `DECART_API_KEY` / `LLM_API_KEY` / `FAL_KEY` xuống client. Client chỉ dùng token ngắn hạn từ `/api/token`.
- Mọi URL do người dùng đưa vào phải đi qua `lib/server/safe-fetch.ts` (chống SSRF), không gọi `fetch` thẳng.
- Không lưu video người dùng trên server (quyết định D8).
- Trước khi kết thúc một thay đổi, chạy trong `apps/web`: `npm run typecheck` và `npm run build`.

## Chạy
`cd apps/web && npm install && copy .env.example .env.local && npm run dev` rồi mở http://localhost:3000/try (mặc định ở chế độ mock).
