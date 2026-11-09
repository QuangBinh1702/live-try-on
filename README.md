# Live Try-On

Thử đồ ảo **trực tiếp qua camera**, lấy quần áo từ bất kỳ shop online nào (bản làm lại Anywear).
Kế hoạch đầy đủ và **các điểm cần chốt** nằm trong [`PLAN.md`](PLAN.md).

```
live-tryon/
├─ PLAN.md            kế hoạch, quyết định cần chốt, lộ trình
├─ apps/web/          Next.js 16: studio thử đồ + API (token, proxy ảnh, VLM, tách đồ)
└─ apps/extension/    Chrome extension MV3 (JS thuần, không cần build)
```

## Chạy trên Windows (5 phút)

Yêu cầu: Node.js ≥ 20, Chrome.

```powershell
cd D:\live-tryon\apps\web
npm install
copy .env.example .env.local
npm run dev
```

Mở http://localhost:3000/try.

- **Mặc định là `VTON_PROVIDER=mock`**: chạy miễn phí, dán ảnh quần áo lên vùng thân người để test toàn bộ giao diện.
- **Chạy AI thật:** tạo key ở https://platform.decart.ai (tài khoản mới có free credit), rồi sửa `.env.local`:
  ```
  VTON_PROVIDER=decart
  DECART_API_KEY=...
  ```
- **Prompt tốt hơn** (khuyến nghị, miễn phí): tạo key Gemini ở https://aistudio.google.com rồi điền `LLM_API_KEY`. Đặt `LLM_MODEL` là một model Flash đang miễn phí trong AI Studio.
- **Bảo vệ credit khi demo:** đặt `DEMO_ACCESS_CODE=...`. Chỉ ai nhập đúng mã trong studio mới dùng được AI thật.
- **Tự tách quần áo khỏi ảnh người mẫu** (tùy chọn, tốn phí): điền `FAL_KEY`.

Sửa `.env.local` xong thì khởi động lại `npm run dev`.

## Cài Chrome extension

1. Mở `chrome://extensions` và bật **Developer mode**.
2. Bấm **Load unpacked** rồi chọn `D:\live-tryon\apps\extension`.
3. Vào một trang shop bất kỳ và rê chuột lên ảnh sản phẩm. Bấm **Thử đồ**, hoặc chuột phải vào ảnh rồi chọn **Thử đồ với ảnh này**.
4. Có thể kéo ảnh từ trang shop thả thẳng vào cửa sổ thử đồ.

Nếu web app không chạy ở `http://localhost:3000`, mở **Cài đặt** của extension để đổi địa chỉ.

## Test trên điện thoại
Camera chỉ chạy trên HTTPS. Dùng tunnel, ví dụ `npx cloudflared tunnel --url http://localhost:3000` hoặc `ngrok http 3000`, rồi mở link HTTPS trên điện thoại.

## Git (bắt buộc cho hồ sơ dự thi)
```powershell
cd D:\live-tryon
git init
git add .
git commit -m "MVP: live try-on web app + Chrome extension"
```
Sau đó tạo repo trên GitHub và `git push`. Ban tổ chức yêu cầu link repo có lịch sử commit.

## Lệnh
| Lệnh (trong `apps/web`) | Việc |
|---|---|
| `npm run dev` | Chạy dev |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` / `npm start` | Build và chạy production |

## Bảo mật đã có
- API key Decart không bao giờ xuống trình duyệt. Token sống 60 s, chỉ dùng cho model VTON, phiên bị cắt ở `MAX_SESSION_SECONDS`, kết nối lại không kéo dài được phiên.
- Hạn mức `FREE_SESSIONS_PER_DAY` theo IP. Nếu tạo token thất bại thì lượt được hoàn lại.
- Proxy ảnh chặn IP nội bộ/localhost/metadata cloud (kiểm tra ngay lúc kết nối, chống DNS rebinding), giới hạn 8 MB, chỉ nhận ảnh raster.
- Không lưu video trên server; clip ghi lại chỉ nằm trên máy người dùng.

## Ghi công
Quy tắc viết prompt và luồng tích hợp tham khảo từ [DecartAI/tryon-examples](https://github.com/DecartAI/tryon-examples) (MIT License).
