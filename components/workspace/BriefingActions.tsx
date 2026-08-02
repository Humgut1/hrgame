"use client";

import Link from "next/link";

import { useSession } from "@/lib/game/SessionProvider";

/**
 * 브리핑을 확인해야 조사 국면이 시작된다. (기획서 §11 국면 briefing → investigate)
 * 국면 전환은 이 dispatch 하나로만 일어난다 — LLM도 페이지 이동도 국면을 바꾸지 않는다.
 */
export function BriefingActions() {
  const { state, dispatch, restart } = useSession();
  const started = state.phaseId !== "briefing";

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/workspace/messages"
        onClick={() => dispatch({ type: "ack_briefing" })}
        className="inline-flex items-center rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
      >
        {started ? "메신저 열기" : "확인했습니다 · 메신저 열기"}
      </Link>
      <Link
        href="/workspace/docs"
        onClick={() => dispatch({ type: "ack_briefing" })}
        className="inline-flex items-center rounded-[10px] border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
      >
        자료실 먼저 보기
      </Link>

      {started ? (
        <button
          type="button"
          onClick={() => {
            if (confirm("지금까지의 대화와 남은 시간이 모두 초기화됩니다. 다시 시작할까요?")) {
              restart();
            }
          }}
          className="ml-auto text-xs text-muted underline-offset-2 hover:text-urgent hover:underline"
        >
          처음부터 다시
        </button>
      ) : null}
    </div>
  );
}
