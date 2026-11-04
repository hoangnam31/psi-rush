import type { Metadata, Viewport } from "next";
import { ZoomGuard } from "../components/ZoomGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSI RUSH — Internal Party Race",
  description: "Tạo phòng, quét mã tham gia và thi đấu nhiều vòng cùng đồng đội.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased"><ZoomGuard/>{children}</body>
    </html>
  );
}
