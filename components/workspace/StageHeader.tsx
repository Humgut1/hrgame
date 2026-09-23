"use client";

import Link from "next/link";

import { useSession } from "@/lib/game/SessionProvider";

export function StageHeader({ companyName }: { companyName: string }) {
  const { scenario, clock } = useSession();
  const pct = Math.min(100, Math.round((clock.turnsUsed / scenario.clock.maxTurns) * 100));
  // 로고 이니셜은 "㈜"/"(주)" 같은 법인 표기를 건너뛴 첫 글자로 뽑는다.
  const logoInitial = companyName.replace(/^\(주\)|^㈜/, "").slice(0, 1);

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center gap-3 bg-shell-bg px-3.5 py-2 text-white">
        <Link href="/sim" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-[7px] bg-accent text-xs font-extrabold"
          >
            {logoInitial}
          </span>
          <span className="whitespace-nowrap text-[13px] font-bold tracking-tight">
            {companyName} 워크스페이스
          </span>
          <span className="hidden truncate border-l border-shell-border pl-2.5 text-[11px] text-shell-muted sm:inline">
            {scenario.title}
          </span>
        </Link>

        <div className="min-w-2 flex-1" />

        <div className="flex items-stretch gap-3.5 rounded-xl border border-shell-border bg-shell-card px-3.5 py-2">
          <div>
            <div className="mb-0.5 text-[9px] font-extrabold tracking-[0.16em] text-shell-muted">
              현재 시각
            </div>
            <div className="font-mono text-[26px] font-bold leading-none tracking-tight">
              {clock.now}
            </div>
          </div>
          <div className="w-px bg-shell-border" aria-hidden />
          <div>
            <div className="mb-0.5 whitespace-nowrap text-[9px] font-extrabold tracking-[0.16em] text-shell-muted">
              {clock.deadline} 까지
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={[
                  "font-mono text-[22px] font-bold leading-none",
                  clock.isTight ? "text-urgent" : "",
                ].join(" ")}
              >
                {clock.minutesLeft}
              </span>
              <span className="text-xs font-bold text-shell-muted">분</span>
            </div>
          </div>
          <div className="w-px bg-shell-border" aria-hidden />
          <div className="flex min-w-[132px] flex-col justify-center gap-1.5">
            <div className="h-[7px] overflow-hidden rounded-full bg-shell-border">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="whitespace-nowrap text-[10px] font-semibold text-shell-muted">
              메시지 1건 발송 ={" "}
              <span className="font-mono text-shell-text">
                {scenario.clock.minutesPerMessage}
              </span>
              분 경과
            </div>
          </div>
        </div>
      </header>

      {clock.isTight ? (
        <div className="shrink-0 bg-urgent-soft px-4 py-1.5 text-center text-xs font-semibold text-urgent">
          마감 {clock.deadline} 전입니다. 오퍼 제출을 마무리하세요.
        </div>
      ) : null}
    </>
  );
}
