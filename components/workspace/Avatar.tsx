"use client";

import { useState } from "react";

const SIZES = {
  xs: "h-[22px] w-[22px] text-[11px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-13 w-13 text-lg",
} as const;

/** 이름별로 고정된 색을 뽑는다 — 데이터에 색이 없어도 사람마다 구분은 되게. */
const PALETTE = [
  { bg: "#E9EEFA", fg: "#2F5FCE" },
  { bg: "#F4EDE3", fg: "#8A5A2B" },
  { bg: "#ECFDF3", fg: "#067647" },
  { bg: "#FFF8EB", fg: "#8A5A17" },
] as const;

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

/**
 * 프로필 사진. (기획서 §10.1)
 * 이미지 파일이 아직 없거나 로드에 실패하면 이름 첫 글자로 떨어진다.
 */
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const base = `${SIZES[size]} shrink-0 rounded-[10px] object-cover`;

  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- 시나리오 데이터가 주는 정적 경로
    return (
      <img
        src={src}
        alt=""
        className={`${base} bg-sunken`}
        onError={() => setFailed(true)}
      />
    );
  }

  const { bg, fg } = colorFor(name);
  return (
    <span
      aria-hidden
      className={`${base} flex items-center justify-center font-extrabold`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
