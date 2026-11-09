import Link from "next/link";
import { t } from "@/lib/i18n";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold tracking-tight">{t.appName}</h1>
      <p className="text-lg text-neutral-600">{t.tagline}</p>
      <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
        <li>Bật camera.</li>
        <li>Kéo ảnh một món đồ từ bất kỳ trang shop nào vào khung hình (hoặc dán link/ảnh).</li>
        <li>Khoảng một, hai giây sau, bạn thấy mình mặc nó và có thể xoay người, giơ tay.</li>
      </ol>
      <div className="flex flex-wrap gap-3">
        <Link href="/try" className="btn-primary px-6 py-2.5 text-base">Thử ngay</Link>
        <span className="btn px-6 py-2.5 text-base" title="chrome://extensions → Developer mode → Load unpacked → apps/extension">
          Chrome extension: cài từ thư mục <code>apps/extension</code>
        </span>
      </div>
      <p className="text-xs text-neutral-400">Kết quả do AI tạo; dùng để xem kiểu dáng và màu, không đánh giá size.</p>
    </main>
  );
}
