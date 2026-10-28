import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wobble Rush Arena — Internal Party Race",
  description: "Tạo phòng, quét mã tham gia và thi đấu nhiều vòng cùng đồng đội.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
