import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "번개분양",
  description: "빠르고 정확한 분양 정보",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
