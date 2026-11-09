export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl p-6 text-sm">
      <h1 className="text-2xl font-semibold">Chính sách quyền riêng tư (bản nháp)</h1>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-600">
        <li>Video camera được truyền trực tiếp từ trình duyệt tới nhà cung cấp mô hình AI (Decart) qua WebRTC trong thời gian phiên. Máy chủ của chúng tôi không nhận và không lưu video.</li>
        <li>Khi bạn thêm một món đồ, ảnh món đồ và một khung hình nhỏ từ camera được gửi tới mô hình ngôn ngữ thị giác (nhà cung cấp do quản trị cấu hình) để viết mô tả; không lưu lại.</li>
        <li>Clip bạn ghi chỉ nằm trên máy bạn.</li>
        <li>Chúng tôi ghi nhận địa chỉ IP trong bộ nhớ tạm để giới hạn số lượt miễn phí.</li>
        <li>TODO: bổ sung chính sách dữ liệu của Decart và nhà cung cấp VLM trước khi phát hành.</li>
      </ul>
    </main>
  );
}
