"use client";

import { useEffect, useRef } from "react";

import { Composer } from "@/components/messages/Composer";
import { MessageBubble, TypingBubble } from "@/components/messages/MessageBubble";
import { Avatar } from "@/components/workspace/Avatar";
import { useSession } from "@/lib/game/SessionProvider";

export function Thread({ npcId }: { npcId: string }) {
  const { scenario, state } = useSession();
  const bottom = useRef<HTMLDivElement>(null);

  const npc = scenario.npcs.find((n) => n.id === npcId);
  const session = state.npcs[npcId];

  const messageCount = session?.messages.length ?? 0;
  const pending = session?.pending ?? false;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, pending]);

  if (!npc || !session) return null;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-5">
        <Avatar name={npc.name} src={npc.avatar} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{npc.name}</div>
          <div className="truncate text-[11px] text-muted">
            {npc.title}
            {npc.relationToPlayer ? ` · ${npc.relationToPlayer}` : ""}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex justify-center">
            <span className="rounded-full bg-sunken px-3 py-1 text-[10.5px] font-bold text-muted">
              {scenario.clock.startTime} 업무 시작
            </span>
          </div>

          {session.messages.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              authorName={npc.name}
              authorAvatar={npc.avatar}
              grouped={i > 0 && session.messages[i - 1].from === message.from}
            />
          ))}

          {session.pending ? (
            <TypingBubble authorName={npc.name} authorAvatar={npc.avatar} />
          ) : null}

          {session.error ? (
            <p className="mt-4 rounded-lg border border-urgent/30 bg-urgent-soft px-3 py-2 text-xs text-urgent">
              {session.error} — 이 메시지는 턴을 소모하지 않았습니다.
            </p>
          ) : null}

          <div ref={bottom} />
        </div>
      </div>

      <Composer npcId={npc.id} npcName={npc.name} />
    </>
  );
}
