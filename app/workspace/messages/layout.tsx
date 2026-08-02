import { ConversationList } from "@/components/messages/ConversationList";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0">
      {/* 목록의 미리보기·시각·신뢰도는 세션 상태에서 온다. 서버는 관여하지 않는다. */}
      <ConversationList />
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}
