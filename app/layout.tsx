import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "./globals.css";

// 연봉·시간·점수 같은 숫자 전용 서체. --font-mono가 이 변수를 참조한다.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "HR 실무 시뮬레이터",
  description: "실제 회사에서 일하는 것처럼 HR 의사결정을 연습한다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={jetbrainsMono.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
