import { redirect } from "next/navigation";

import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default function MessagesIndexPage() {
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);

  // 메신저는 항상 열려 있는 대화 하나를 보여준다. 빈 화면으로 들여보내지 않는다.
  redirect(`/workspace/messages/${scenario.npcs[0].id}`);
}
