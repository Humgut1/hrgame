"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/game/SessionProvider";
import { Avatar } from "@/components/workspace/Avatar";

export function ConversationList() {
  const pathname = usePathname();
  const { scenario, state } = useSession();

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-line bg-sunken">
      <h2 className="px-4 pt-3.5 pb-2 text-[10px] font-extrabold tracking-[0.14em] text-muted">
        다이렉트 메시지
      </h2>
      <ul className="space-y-0.5 px-2 pb-2">
        {scenario.npcs.map((npc) => {
          const href = `/workspace/messages/${npc.id}`;
          const active = pathname === href;
          const session = state.npcs[npc.id];
          const last = session.messages[session.messages.length - 1];

          return (
            <li key={npc.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-surface",
                ].join(" ")}
              >
                <Avatar name={npc.name} src={npc.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-ink">{npc.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
                      {last.time}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] leading-snug text-ink-soft">
                    {session.pending
                      ? "입력 중…"
                      : `${last.from === "player" ? "나: " : ""}${last.text}`}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
