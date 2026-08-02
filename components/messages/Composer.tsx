"use client";

import { useState } from "react";

import { useSession } from "@/lib/game/SessionProvider";

/**
 * 입력창. 전송은 세션의 sendMessage로만 나간다 — 턴 소모와 국면 판정이 거기 붙어 있다.
 * Enter로 보내고 Shift+Enter로 줄바꿈한다. 사내 메신저의 관습이다.
 */
export function Composer({ npcId, npcName }: { npcId: string; npcName: string }) {
  const { scenario, clock, canSend, blockedReason, sendMessage } = useSession();
  const [draft, setDraft] = useState("");

  const text = draft.trim();
  const disabled = !canSend;

  async function submit() {
    if (disabled || !text) return;
    setDraft("");
    await sendMessage(npcId, text);
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface px-5 py-3">
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={
            blockedReason ?? `${npcName}님에게 보낼 메시지를 입력하세요 (Enter로 전송)`
          }
          className="min-h-[3rem] flex-1 resize-none rounded-[10px] border border-line-strong bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled || !text}
          onClick={() => void submit()}
          className="h-[3rem] shrink-0 rounded-[10px] bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted"
        >
          보내기
        </button>
      </div>
      <p
        className={[
          "mt-2 text-[11px]",
          clock.isTight ? "text-urgent" : "text-muted",
        ].join(" ")}
      >
        메시지 1건에 {scenario.clock.minutesPerMessage}분이 소모됩니다. 남은 메시지{" "}
        {clock.turnsLeft}건 · 현재 {clock.now}.
      </p>
    </div>
  );
}
