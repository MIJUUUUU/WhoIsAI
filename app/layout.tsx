import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "누가 AI일까?",
  description: "채팅으로 숨어든 AI를 찾아내는 소셜 디덕션 게임",
  metadataBase: new URL("https://whoisai.mijoo.co.kr"),
  openGraph: {
    title: "누가 AI일까?",
    description: "채팅으로 숨어든 AI를 찾아내는 소셜 디덕션 게임",
    url: "https://whoisai.mijoo.co.kr",
    siteName: "누가 AI일까?",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "누가 AI일까? 게임 대표 이미지" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "누가 AI일까?",
    description: "채팅으로 숨어든 AI를 3분 안에 찾아내세요",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
