"use client";

/**
 * 좌측 사이드바의 이해관계자 신뢰도 게이지. (기획서 §10.1)
 * 신뢰도는 서버가 판정해 세션 상태에 반영한 값을 그대로 그린다 — 여기서 계산하지 않는다.
 */

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/workspace/Avatar";
import { useSession } from "@/lib/game/SessionProvider";

function TrustRow({
  name,
  title,
  avatar,
  trust,
}: {
  name: string;
  title: string;
  avatar?: string;
  trust: number;
}) {
  const prev = useRef(trust);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    const diff = trust - prev.current;
    prev.current = trust;
    if (diff === 0) return;
    setDelta(diff);
    const timer = setTimeout(() => setDelta(null), 2600);
    return () => clearTimeout(timer);
  }, [trust]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Avatar name={name} src={avatar} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold leading-tight text-ink">{name}</div>
          <div className="truncate text-[10px] leading-tight text-muted">{title}</div>
        </div>
        <div className="font-mono text-[13px] font-bold text-ink">{trust}</div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, trust))}%` }}
        />
      </div>
      {delta !== null ? (
        <div
          className={[
            "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold",
            delta > 0 ? "bg-success-soft text-success-text" : "bg-urgent-soft text-urgent",
          ].join(" ")}
        >
          {delta > 0 ? `+${delta}` : delta}
        </div>
      ) : null}
    </div>
  );
}

export function TrustPanel() {
  const { scenario, state } = useSession();

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="mb-3 px-2 text-[10px] font-extrabold tracking-[0.14em] text-muted">
        이해관계자 신뢰도
      </div>
      <div className="space-y-4">
        {scenario.npcs.map((npc) => (
          <TrustRow
            key={npc.id}
            name={npc.name}
            title={npc.title}
            avatar={npc.avatar}
            trust={state.npcs[npc.id]?.trust ?? npc.initialTrust}
          />
        ))}
      </div>
    </div>
  );
}
