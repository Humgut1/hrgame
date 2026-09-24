import type { Metadata } from "next";
import { JetBrains_Mono, Unbounded } from "next/font/google";

import "./globals.css";

// 연봉·시간·점수 같은 숫자 전용 서체. --font-mono가 이 변수를 참조한다.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
});

// 로고 글자(talentcore) 전용. components/BrandMark.tsx 가 --font-unbounded 를 쓴다.
const unbounded = Unbounded({ subsets: ["latin"], weight: ["700"], variable: "--font-unbounded" });

export const metadata: Metadata = {
  title: "Grow",
  description: "TalentCore 계정으로 듣는 사내 직무 교육",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${jetbrainsMono.variable} ${unbounded.variable}`}>
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
