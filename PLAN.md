# Live Try-On: kế hoạch làm lại Anywear (Live Virtual Try-On)

> Cập nhật: 08/11/2026 · Thư mục: `D:\live-tryon`
> Mục tiêu: thử đồ ảo **trực tiếp qua camera**, lấy quần áo từ bất kỳ shop online nào. Chất lượng ngang Anywear, đồng thời sửa những điểm yếu mà người dùng Anywear đã phản ánh.

---

## 0. Quyết định (cập nhật 08/11/2026)

**Mục tiêu dự án: đi thi** (Startup Runway 2027 + Cuộc thi Sáng tạo trẻ Quốc gia lĩnh vực AI). Xem mục 7.

| # | Nội dung | Trạng thái | Chốt / khuyến nghị |
|---|---|---|---|
| D1 | Mô hình AI | ✅ **Làm cả 2** | **Nhánh sản phẩm** dùng API Decart Lucy VTON để có demo chất lượng cao ngay. **Nhánh nghiên cứu** tự làm model (giai đoạn 4, mục 8), đây là đóng góp khoa học để đi thi. Hai nhánh cắm chung vào lớp provider |
| D2 | Phạm vi giai đoạn 1 | ✅ **Web app + extension** | Widget cho shop để giai đoạn 3 |
| D3 | VLM viết prompt | ✅ (do chưa có ngân sách) | **Gemini free tier** qua endpoint chuẩn OpenAI (không cần thẻ). Khi có tiền thì đổi sang gpt-4o-mini chỉ bằng `.env` |
| D4 | Tách quần áo (fal) | ✅ **Tắt** | fal tốn tiền. Dùng ảnh sản phẩm không có người mẫu; VLM vẫn cảnh báo khi ảnh có người |
| D5/D6 | Ngân sách & hạn mức | ✅ **Chưa có ngân sách** | Dev bằng `mock` (0 đồng). AI thật chỉ dùng free credit của Decart cho quay demo và trình diễn. Mặc định **30 s/phiên, 3 phiên/ngày/IP** + **mã truy cập `DEMO_ACCESS_CODE`** (người lạ không dùng được credit). Có thể liên hệ contact@decart.ai hỏi chương trình hỗ trợ sinh viên/startup (chưa xác minh có hay không) |
| D7 | Fast mode | ✅ Tắt | Giá gấp đôi |
| D8 | Lưu video | ✅ Chỉ ở máy người dùng | Phù hợp tiêu chí "đạo đức & bảo vệ dữ liệu" của bảng C |
| D9 | Ngôn ngữ | ✅ VI trước | — |
| D10 | Triển khai | ✅ Vercel (free) | — |
| D11 | Cửa sổ extension | ✅ Popup window | — |
| D12 | Tên sản phẩm | ⏳ **Chờ bạn chọn** | Đề xuất **MặcThử**, slogan *"Gương thần thử đồ trực tiếp"* (xem mục 7.3) |
| D13 | 18+ | ✅ Bắt buộc | — |

## 1. Tính năng của Anywear (đã khảo sát) → bản làm lại

Nguồn: trang chính thức Anywear, Chrome Web Store (v2.20, 50.000 người dùng, 3,4★), review WearTryOn, repo mẫu chính thức `DecartAI/tryon-examples` (MIT).

| Mảng | Tính năng Anywear | Bản làm lại | Giai đoạn |
|---|---|---|---|
| Extension | Nhãn "Virtual Try On" trên ảnh quần áo, chỉ người dùng thấy | Nhãn "Thử đồ" hiện khi rê chuột lên ảnh đủ lớn | 1 ✅ |
| Extension | Cửa sổ pop-up, kéo ảnh vào | Popup window + kéo thả + click nhãn + menu chuột phải "Thử đồ này" | 1 ✅ |
| Extension | Chạy mọi trang (shop, Pinterest) | `<all_urls>`, có nút tắt theo từng site | 1 ✅ |
| Lõi | Garment xuất hiện sau ~1,5 s, bám theo chuyển động | Lucy VTON qua WebRTC, đo và hiển thị thời gian tới frame đầu | 1 ✅ |
| Lõi | Đổi món không cần kết nối lại | `setImage()` trên phiên đang mở | 1 ✅ |
| Lõi | Toàn màn hình, tải video phiên | Fullscreen + ghi `.webm` | 1 ✅ |
| Lõi | Hàng đợi khi quá tải | Hiển thị vị trí hàng đợi / chờ capacity từ SDK | 1 ✅ |
| Ẩn | Phát hiện người (MediaPipe) → chỉ kết nối khi có người | Tự ngắt sau ~3 s không thấy người (tiết kiệm credit) | 1 ✅ |
| Ẩn | Sinh prompt bằng VLM (ảnh đồ + frame camera) | Gộp **1 lần gọi VLM**: phân loại + kiểm tra hỗ trợ + phát hiện người mẫu + prompt | 1 ✅ |
| Ẩn | Tách quần áo khỏi ảnh người mẫu | fal Flux Klein 4B edit (tùy chọn) | 1 ✅ |
| Ẩn | Kiểm tra món có hỗ trợ không / khung hình đủ chưa | Danh sách ~30 loại; MediaPipe kiểm tra thân trên/hông/gối | 1 ✅ |
| Ẩn | Kiểm tra mạng trước khi vào, cảnh báo mạng yếu | `checkConnectivity()` + `onConnectionQuality` | 1 ✅ |
| Lõi | Sửa prompt thủ công | Ô sửa prompt + áp lại | 1 ✅ |
| Mới | — | **Chụp nhanh & so sánh outfit cạnh nhau** | 1 ✅ |
| Mới | — | **Xem trước/sau** (camera gốc ở góc màn hình) | 1 ✅ |
| Lõi | Web app chạy trên điện thoại | Responsive, camera trước/sau | 1 ✅ (cần HTTPS khi test trên điện thoại) |
| Mới | — | Lịch sử món đã thử, yêu thích (theo tài khoản) | 2 |
| Ẩn | Ghép áo + quần | Outfit Builder (2 ảnh → 1 prompt) | 2 |
| Ẩn | "Extreme precision" cho phụ kiện | Flux Klein 9B + LoRA try-on tạo ảnh tham chiếu trước | 2 |
| Lõi | Chia sẻ clip lên mạng xã hội | Web Share API / tải về + watermark | 2 |
| B2B | Widget script ~17 KB, iframe cô lập, tự tìm ảnh sản phẩm | `embed.js` + iframe + cấu hình theo shop | 3 |
| B2B | Chỉ hiện nút với món render tốt, chủ shop xem trước qua extension | Quality pass bằng VLM + lưu cache theo SKU | 3 |
| B2B | Shopify app, WooCommerce | App embed Shopify, plugin WP | 3 |
| B2B | Số liệu: add-to-cart, số món/phiên, thời lượng | Dashboard analytics cho chủ shop | 3 |

### Điểm yếu của Anywear và cách xử lý
| Điểm yếu (review) | Cách xử lý |
|---|---|
| Bịa phụ kiện (đồng hồ, mũ lấy từ ảnh người mẫu) | Tách quần áo ra nền trắng trước. Prompt cấm mô tả thứ không nhìn thấy |
| Quần bị đặt sai vùng cơ thể | Kiểm tra khung hình: thử quần mà không thấy hông/gối thì nhắc lùi ra xa |
| Hàng đợi quay vòng, crash, khởi động chậm | Hiển thị rõ trạng thái hàng đợi/capacity, tự kết nối lại, đặt timeout |
| Không đánh giá được size | Ghi rõ trong UI: đây là công cụ xem kiểu dáng/màu, không phải đo size |
| Chính sách dữ liệu rộng | Không lưu video trên server. Token chỉ sống ngắn, giới hạn model/origin |

---

## 2. Kiến trúc

```
┌──────────── Trình duyệt người dùng ────────────┐
│ Shop bất kỳ ──(content script: nhãn Thử đồ)──┐ │
│                                              ▼ │
│ Extension background ──► Popup window = Web app /try
│   Web app:                                        │
│   • getUserMedia (camera)                         │
│   • MediaPipe Pose (WASM, chạy local) → có người? │
│     khung hình đủ chưa?                           │
│   • Decart SDK ── WebRTC ──────────────────────────┼──► Decart Lucy VTON (GPU cloud)
│   • MediaRecorder (ghi clip tại máy)              │      ◄── video đã mặc đồ
└───────────────┬───────────────────────────────────┘
                │ HTTPS (chỉ dữ liệu nhỏ)
┌───────────────▼────────── Next.js API (server) ───────────┐
│ POST /api/token        → token ngắn hạn (model, origin,    │
│                          thời lượng tối đa) + hạn mức/IP    │
│ GET  /api/garment/fetch→ proxy ảnh chống SSRF (CORS)        │
│ POST /api/garment/prepare → VLM: phân loại + prompt         │
│                          (+ fal: tách quần áo)              │
│ GET  /api/config       → tính năng nào đang bật             │
└─────────────────────────────────────────────────────────────┘
```

**Nguyên tắc bảo mật**
- API key cố định không bao giờ xuống trình duyệt. Token sống 60 s, chỉ dùng được cho model VTON, chỉ từ origin được phép, và phiên bị cắt ở `MAX_SESSION_SECONDS`.
- Proxy ảnh chỉ nhận http/https, tự phân giải DNS và **chặn IP nội bộ** (chống SSRF), chặn redirect sang IP nội bộ, giới hạn 8 MB, bắt buộc `content-type: image/*`, timeout 10 s.
- Có rate-limit theo IP cho mọi API.

**Tách lớp provider** (`lib/client/providers`): `decart` (thật) và `mock` (vẽ ảnh đồ lên camera bằng canvas để test UI không tốn tiền). Giai đoạn 4 thêm `selfhost` (WebRTC tới server GPU của lab) mà không phải sửa UI.

---

## 3. Stack

| Tầng | Chọn | Ghi chú |
|---|---|---|
| Web | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 | Có ví dụ chính thức của Decart chạy Next.js |
| Realtime | `@decartai/sdk` 0.2.x, model `lucy-vton-latest` (= 3.6, 1280×720, 30 fps) | WebRTC qua LiveKit (bên trong SDK) |
| Thị giác tại máy | `@mediapipe/tasks-vision` PoseLandmarker lite (GPU, CPU fallback) | Phát hiện người + khung hình |
| VLM | Endpoint chuẩn OpenAI (`LLM_BASE_URL`, `LLM_MODEL`) | Mặc định Gemini free tier; trả phí thì gpt-4o-mini |
| Tách đồ | `@fal-ai/client`, `fal-ai/flux-2/klein/4b/base/edit` | Tùy chọn |
| Extension | Chrome MV3, JavaScript thuần (không cần build) | Load unpacked |
| Kiểm tra dữ liệu | zod | Validate env + input API |
| Giai đoạn 2+ | Supabase (Auth + Postgres), Redis/Upstash cho quota | — |

---

## 4. Lộ trình

| Giai đoạn | Thời gian | Nội dung | Tiêu chí xong |
|---|---|---|---|
| **1. MVP** | Tuần 1–2 | Toàn bộ mục ✅ ở bảng tính năng (**đã dựng khung code hôm nay**) | Kéo ảnh từ Zara/Shopee → thấy mình mặc trong ≤ 2 s. Phiên tự cắt đúng hạn. Không lộ key |
| 2. Tài khoản & trải nghiệm | Tuần 3–4 | Supabase Auth, lịch sử/yêu thích, Outfit Builder, Extreme precision, chia sẻ clip, EN | 10 người dùng thử, thu phản hồi |
| 3. B2B widget | Tuần 5–8 | `embed.js`, dashboard shop, analytics, quality pass, Shopify app embed | 1 shop thật cài thử |
| 4. Nghiên cứu (**đã chốt làm**, mục 8) | Song song từ khi có thông tin GPU lab | Tự làm model theo công thức LiveVVT/Self Forcing | Đạt ≥ 15 FPS ở 512×384, có bảng so sánh với Decart |

### Việc cụ thể của giai đoạn 1 (checklist)
- [x] Khung monorepo `apps/web`, `apps/extension`
- [x] API token có hạn mức + ràng buộc phiên
- [x] Proxy ảnh chống SSRF
- [x] VLM prepare (phân loại, prompt, phát hiện người mẫu) + fallback
- [x] Tách quần áo qua fal (tùy chọn)
- [x] Studio thử đồ: camera, kết nối, đổi món, sửa prompt, trạng thái, hàng đợi, chất lượng mạng, đồng hồ đếm ngược
- [x] MediaPipe: tự kết nối/ngắt theo người, kiểm tra khung hình theo loại đồ
- [x] Ghi clip, chụp và so sánh outfit, xem trước/sau, toàn màn hình
- [x] Cổng 18+ / đồng ý điều khoản
- [x] Extension: nhãn, menu chuột phải, popup window, cầu nối gửi ảnh
- [ ] **Bạn:** tạo key Decart (có free credit), chạy thử thật, đo độ trễ
- [ ] Viết trang Điều khoản / Quyền riêng tư
- [ ] Test trên Chrome Windows + Android (qua HTTPS tunnel)

---

### Kết quả kiểm tra tự động (08/11/2026)
| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit`, `next build` | ✅ sạch |
| Studio (Chrome headless + camera giả, chế độ mock): đồng ý 18+ → camera → thêm ảnh → đang mặc → chụp ×2 → so sánh → dừng | ✅ |
| Extension: nhãn "Thử đồ" hiện trên ảnh ≥ 140 px (ảnh nhỏ bỏ qua) → bấm → mở popup window → cầu nối → web app nhận ảnh, tự kết nối | ✅ |
| Proxy ảnh chặn `127.0.0.1`, `localhost`, `169.254.169.254`, `[::1]`, `0x7f000001`, `10.x`, cổng lạ, `file://`, `ftp://`, SVG | ✅ |
| Hạn mức/ngày, sessionId sai, chế độ mock trả 409, hoàn lượt khi tạo token lỗi | ✅ |
| `/api/garment/prepare` không có key VLM → prompt dự phòng + `enhance: true` | ✅ |
| **Chưa test được** (sandbox không có mạng ra ngoài/key): tải ảnh từ shop thật, Decart thật, VLM thật, fal, MediaPipe CDN | ⏳ bạn chạy trên máy |

### Giới hạn đã biết (để xử lý ở giai đoạn 2)
- Khi phiên **tạm dừng vì không thấy người**, đồng hồ phía server vẫn chạy (để không ai kéo dài phiên được). Người dùng mất thời gian chờ nhưng không mất credit.
- Hạn mức lưu trong RAM: mất khi server khởi động lại, và không chia sẻ giữa nhiều instance.
- "Phản hồi gần nhất" đo tới lúc model **nhận** ảnh, chưa phải lúc frame có đồ hiện ra. Muốn đo TTFG chính xác cần so sánh khung hình (giai đoạn 2).

## 5. Đo lường (để báo cáo có số liệu)
- **TTFG** (time-to-first-garment): từ lúc thả ảnh tới frame đầu có đồ. Mốc của Anywear ~1,5 s.
- Độ trễ prepare (VLM + tách đồ), tính riêng.
- `connectionQuality` (good/fair/poor/critical) và `g2gMs` từ SDK.
- Chi phí: giây generation/phiên (từ sự kiện `generationTick`).
- Tỉ lệ món bị từ chối (không hỗ trợ / khung hình sai).

## 6. Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Phụ thuộc giá & điều khoản của Decart | Đã tách lớp provider, giai đoạn 4 có phương án tự host |
| Chi phí tăng vọt nếu bị lạm dụng | Token ép thời lượng, hạn mức/IP, ngắt khi không có người |
| Ảnh từ shop có bản quyền | Chỉ xử lý tạm thời, không lưu, không phát tán |
| Quota in-memory mất khi deploy serverless | Giai đoạn 2 chuyển sang Redis/Supabase |

## 7. Đi thi

### 7.1 Hai cuộc thi
| | Startup Runway (ĐH Kinh tế – ĐHĐN) | Sáng tạo trẻ Quốc gia lĩnh vực AI (TW Đoàn), **bảng C** |
|---|---|---|
| Lịch (theo mùa trước) | Mùa 2025: khởi động 2/2025, chung kết 23/8/2025. Mùa 2027 dự kiến tương tự, **cần xác nhận** | Mùa 2026: đội tự do đăng ký 10/7–20/9, vòng khu vực (hackathon 2 ngày), chung kết 20–22/11/2026 |
| Đối tượng | Sinh viên/học sinh nhiều trường | HS-SV đang học **hoặc** công dân 12–22 tuổi; đội tối đa 3 người |
| Nặng về | Mô hình kinh doanh, pitching | Bài toán, phương pháp khoa học, **dữ liệu**, **làm chủ model/kiến trúc**, cách đánh giá, rủi ro & bảo mật, đạo đức |
| Hồ sơ | Theo thể lệ mùa 2027 | PDF ≤ 20 trang, video thuyết trình ≤ 5', demo ≤ 5', **link repo có lịch sử commit**, báo cáo kỹ thuật, **nhật ký prompt + khai báo công cụ AI, dataset, API, mã nguồn mở** |

> ⚠️ **Rủi ro điều kiện dự thi Sáng tạo trẻ AI 2027:** bạn dự kiến tốt nghiệp 06/2027 và sẽ 23 tuổi từ 17/02/2027. Nếu mùa 2027 giữ lịch đăng ký tháng 7–9 và quy định "đang học hoặc 12–22 tuổi" như mùa 2026, bạn **có thể không còn đủ điều kiện**. Cần hỏi BTC sớm. Phương án dự phòng: một thành viên đội vẫn đang là sinh viên; tập trung Startup Runway (bắt đầu khoảng tháng 2, khi bạn vẫn đang học).

### 7.2 Việc cần làm ngay vì yêu cầu hồ sơ
- **Khởi tạo git và đẩy lên GitHub ngay hôm nay.** BTC yêu cầu lịch sử commit thật.
- **Lưu nhật ký prompt:** export các cuộc trò chuyện với Claude/Claude Code vào `docs/prompt-log/`, kèm bảng khai báo công cụ AI, API (Decart, Gemini), dataset và mã nguồn mở (DecartAI/tryon-examples – MIT).
- **Bảng đánh giá định lượng** (mục 5): đây là tiêu chí "phương pháp đánh giá" của bảng C.

### 7.3 Tên sản phẩm (D12)
Kiểm tra nhanh trên web ngày 08/11/2026: các tên có chữ "Mirror" đã đông (mirrAR, Mirrafit, MirrorLook...). Chưa thấy app nào tên "Mặc Thử".

| Tên | Ưu | Nhược |
|---|---|---|
| **MặcThử** ⭐ | Nói đúng việc ("mặc thử"), dễ nhớ với người Việt và giám khảo, chưa thấy trùng | Người nước ngoài khó đọc dấu → logo/domain dùng `macthu` |
| Gương Thần | Câu chuyện cổ tích, rất dễ kể khi pitching | Là từ chung (báo chí đã dùng cho gương thử đồ), khó đăng ký nhãn hiệu |
| Thử Liền | Gợi "thử ngay, realtime" | Hơi khẩu ngữ |

**Khuyến nghị:** tên **MặcThử**, slogan **"Gương thần thử đồ trực tiếp"**: vừa có tên riêng, vừa giữ câu chuyện cổ tích để pitching. Trước khi chốt cần tra tên miền và nhãn hiệu trên cơ sở dữ liệu của Cục Sở hữu trí tuệ.

## 8. Nhánh nghiên cứu: tự làm model (D1)
Mục tiêu vừa sức cho đội sinh viên, dùng dữ liệu công khai hoặc tự thu (đúng ràng buộc "không có đối tác dữ liệu"):
1. **Mốc chuẩn:** đo Decart trên cùng bộ video test (FPS, độ trễ, VFID/SSIM/LPIPS nếu có ground truth), làm baseline trong báo cáo.
2. **Phạm vi hẹp:** chỉ áo thân trên, 512×384, mục tiêu ≥ 15 FPS trên GPU của lab.
3. **Công thức** (theo tài liệu đã khảo sát): teacher = fine-tune Wan2.1 1.3B kiểu MagicTryOn trên ViViD (chỉ cho nghiên cứu) → chưng cất causal few-step kiểu Self Forcing/DMD → cửa sổ trượt + bộ nhớ ngoại hình quần áo kiểu LiveVVT.
4. **Điểm khác biệt để đi thi (giả thuyết, cần kiểm chứng):** trang phục Việt Nam (áo dài, áo bà ba...) có thể là điểm yếu của model nước ngoài. Thử trên Decart trước; nếu yếu thật thì tự thu một bộ dữ liệu nhỏ, có đồng ý của người quay, để tinh chỉnh.
5. **Cần bạn cung cấp:** cấu hình GPU của lab (loại card, VRAM, số card, thời gian được dùng).

## 9. Tài liệu tham khảo
- Anywear: https://anywear.decart.ai/ · Chrome Web Store: https://chromewebstore.google.com/detail/anywear-live-virtual-try/hijnklblgecbdlhjiofhlhjpndpifejh
- Decart docs VTON: https://docs.platform.decart.ai/models/realtime/virtual-try-on · Giá: https://docs.platform.decart.ai/getting-started/pricing
- Mẫu chính thức (MIT): https://github.com/DecartAI/tryon-examples
- MirageLSD technical report: https://decart.ai/publications/mirage · Lucy 2.5: https://decart.ai/publications/lucy-2-5-raising-the-bar-for-live-ai
- LiveVVT: https://arxiv.org/abs/2608.26714 · Self Forcing: https://huggingface.co/gdhe17/self-forcing
- Review: https://weartryon.com/guides/anywear
- Thể lệ Sáng tạo trẻ AI 2026: https://tainangviet.vn/source/files/AI2026_Ke%20hoach_The%20le_phathanh.pdf
- Startup Runway 2025: https://nhandan.vn/ocop/sinh-vien-da-nang-voi-nhieu-hoat-dong-y-nghia-tai-ngay-hoi-khoi-nghiep-doi-moi-sang-tao-post903006.html
- Gemini API free tier (OpenAI-compatible): https://www.cometapi.com/gemini-api-free-tier-2026/
