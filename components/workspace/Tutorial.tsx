"use client";

/**
 * 3단계 온보딩. 브리핑을 확인한 직후 한 번만 뜬다(기획서 §10.3).
 *
 * 여기 오는 props는 전부 화면에 그대로 찍을 primitive다 — Scenario 전체가 아니라
 * layout.tsx(서버)가 골라 넘긴 값들이라 secrets가 섞일 여지가 없다.
 */

import { useEffect, useState } from "react";

import { useSession } from "@/lib/game/SessionProvider";
import { hasSeenTutorial, markTutorialSeen } from "@/lib/game/tutorial";

interface Step {
  title: string;
  body: string;
}

function buildSteps(props: {
  docCount: number;
  offerFormTitle: string;
  maxTurns: number;
  minutesPerMessage: number;
  deadlineTime: string;
}): Step[] {
  return [
    {
      title: "1 · 자료실",
      body: `문서 ${props.docCount}건이 있습니다. 연봉 밴드, 결재 권한, 재직자 정보처럼 메신저로는 알려주지 않는 숫자가 여기 있습니다. 열람은 시간을 소모하지 않지만, 안 보고 낸 결정은 채점에서 드러납니다.`,
    },
    {
      title: "2 · " + props.offerFormTitle,
      body: "조사·협상이 끝나면 조건을 정하고 후보자에게 보낼 메시지를 써서 제출합니다. 제출하는 순간 즉시 발송되며 되돌릴 수 없습니다.",
    },
    {
      title: "3 · 시간",
      body: `메신저로 메시지 1건을 보낼 때마다 ${props.minutesPerMessage}분이 흐릅니다. 오늘 쓸 수 있는 메시지는 총 ${props.maxTurns}건, ${props.deadlineTime}까지입니다.`,
    },
  ];
}

export function Tutorial(props: {
  docCount: number;
  offerFormTitle: string;
  maxTurns: number;
  minutesPerMessage: number;
  deadlineTime: string;
}) {
  const { scenario, state, hydrating } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);

  // 저장된 값은 마운트 후에만 읽는다 — 서버 렌더와 첫 클라이언트 렌더를 맞추기 위해서다.
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    setSeen(hasSeenTutorial(scenario.id));
  }, [scenario.id]);

  const visible = !hydrating && !dismissed && !seen && state.phaseId !== "briefing";
  if (!visible) return null;

  const steps = buildSteps(props);
  const last = step === steps.length - 1;

  function finish() {
    markTutorialSeen(scenario.id);
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5">
      <div className="w-full max-w-[26.875rem] rounded-2xl bg-surface p-6 pb-5 shadow-xl">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={[
                "h-[7px] rounded-full transition-all",
                i === step ? "w-5 bg-accent" : "w-[7px] bg-line-strong",
              ].join(" ")}
            />
          ))}
          <span className="flex-1" />
          <span className="font-mono text-[11px] font-bold text-muted">
            {step + 1}/{steps.length}
          </span>
        </div>

        <h2 className="mt-4 text-[19px] font-extrabold leading-snug tracking-tight text-ink">
          {steps[step].title}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.8] text-ink-soft">{steps[step].body}</p>

        <div className="mt-[22px] flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-[9px] border border-line px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-sunken"
            >
              이전
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
            className="rounded-[9px] bg-primary px-5 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-hover"
          >
            {last ? "시작하기" : "다음"}
          </button>
          <button
            type="button"
            onClick={finish}
            className="ml-auto px-2 py-3 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
          >
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}
