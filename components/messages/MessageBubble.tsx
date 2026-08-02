import { Avatar } from "@/components/workspace/Avatar";
import type { SessionMessage } from "@/lib/game/state";

/**
 * 말풍선. 같은 사람이 연달아 보내면 아바타와 이름을 접는다. (기획서 §10.1 말풍선 그룹핑)
 */
export function MessageBubble({
  message,
  authorName,
  authorAvatar,
  grouped = false,
}: {
  message: SessionMessage;
  authorName: string;
  authorAvatar?: string;
  grouped?: boolean;
}) {
  const mine = message.from === "player";

  return (
    <div
      className={[
        "flex gap-2.5",
        mine ? "flex-row-reverse" : "flex-row",
        grouped ? "mt-1" : "mt-4",
      ].join(" ")}
    >
      <div className="w-8 shrink-0">
        {!mine && !grouped ? <Avatar name={authorName} src={authorAvatar} size="sm" /> : null}
      </div>

      <div className={["min-w-0 max-w-[min(32rem,75%)]", mine ? "items-end" : ""].join(" ")}>
        {!grouped ? (
          <div
            className={[
              "mb-1 text-[11px] font-medium text-muted",
              mine ? "text-right" : "",
            ].join(" ")}
          >
            {mine ? "나" : authorName}
          </div>
        ) : null}

        <div className={["flex items-end gap-1.5", mine ? "flex-row-reverse" : ""].join(" ")}>
          <p
            className={[
              "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-sunken text-ink",
              message.failed ? "opacity-50" : "",
            ].join(" ")}
          >
            {message.text}
          </p>

          <div className="shrink-0 pb-0.5 text-[10px] leading-none text-muted tabular-nums">
            {message.failed ? (
              <div className="mb-0.5 text-urgent">전송 실패</div>
            ) : mine && message.read ? (
              <div className="mb-0.5 text-accent">읽음</div>
            ) : null}
            <time>{message.time}</time>
          </div>
        </div>
      </div>
    </div>
  );
}

/** NPC가 답장을 쓰는 동안. 12분이 흐르는 구간이라 비워 두면 화면이 죽어 보인다. */
export function TypingBubble({
  authorName,
  authorAvatar,
}: {
  authorName: string;
  authorAvatar?: string;
}) {
  return (
    <div className="mt-4 flex gap-2.5">
      <div className="w-8 shrink-0">
        <Avatar name={authorName} src={authorAvatar} size="sm" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-sunken px-3.5 py-3">
        <span className="flex gap-1" aria-label={`${authorName}님이 입력 중`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-line-strong"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
