import { notFound } from "next/navigation";

import { Thread } from "@/components/messages/Thread";
import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ npcId: string }>;
}) {
  const { npcId } = await params;
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);

  // 존재 여부만 서버에서 판정한다. 대화 내용은 세션 상태가 소유한다.
  if (!scenario.npcs.some((n) => n.id === npcId)) notFound();

  return <Thread npcId={npcId} />;
}
