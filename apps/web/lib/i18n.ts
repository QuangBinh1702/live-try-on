/** All user-facing strings live here so English can be added later (decision D9). */
export const t = {
  appName: "Live Try-On",
  tagline: "Thử đồ trực tiếp qua camera, với quần áo từ bất kỳ shop nào.",
  status: {
    idle: "Chưa kết nối",
    preflight: "Đang kiểm tra mạng…",
    connecting: "Đang kết nối…",
    queued: "Đang xếp hàng…",
    connected: "Đang chạy",
    generating: "Đang mặc đồ…",
    reconnecting: "Đang kết nối lại…",
    disconnected: "Đã ngắt",
    error: "Lỗi",
  },
  quality: { good: "Mạng tốt", fair: "Mạng ổn", poor: "Mạng yếu", critical: "Mạng rất yếu" },
  drop: "Kéo ảnh quần áo vào đây, dán (Ctrl+V), dán link ảnh hoặc chọn file",
  tips: [
    "Cởi áo khoác dày để kết quả chính xác hơn.",
    "Đứng đủ xa để thấy trọn món đồ, quay mặt về phía nguồn sáng.",
    "Dùng ảnh một món trên nền trơn; ảnh phối nhiều món dễ bị nhầm.",
    "Công cụ giúp xem kiểu dáng và màu, không đánh giá được size.",
  ],
  framing: {
    torso: "Lùi ra một chút để thấy phần thân trên.",
    hips: "Lùi ra xa hơn để thấy phần hông, món này là đồ mặc phía dưới.",
    knees: "Lùi ra xa để thấy tới đầu gối, món này dài tới chân.",
    nobody: "Không thấy ai trong khung hình, phiên sẽ tạm dừng để tiết kiệm lượt.",
  },
} as const;
