import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Try-On: thử đồ trực tiếp qua camera",
  description: "Kéo ảnh quần áo từ bất kỳ shop nào và thấy mình mặc nó trực tiếp qua camera.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
