import { Avatar } from "@/components/workspace/Avatar";
import { StageHeader } from "@/components/workspace/StageHeader";
import { StageNav, type NavItem } from "@/components/workspace/StageNav";
import { Tutorial } from "@/components/workspace/Tutorial";
import { TrustPanel } from "@/components/workspace/TrustPanel";
import { SessionProvider } from "@/lib/game/SessionProvider";
import { ACTIVE_SCENARIO_ID, loadStage, toClientScenario } from "@/lib/data";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { scenario, company } = loadStage(ACTIVE_SCENARIO_ID);

  // 클라이언트로는 반드시 좁혀서 넘긴다. 전체 Scenario를 넘기면 secrets가 브라우저에 실린다.
  const clientScenario = toClientScenario(scenario);

  const items: NavItem[] = [
    {
      href: "/workspace",
      label: "상황 브리핑",
      hint: scenario.briefing.headline.split("—")[0]?.trim(),
    },
    {
      href: "/workspace/messages",
      label: "메신저",
      hint: `${scenario.npcs.map((n) => n.name).join(", ")}`,
    },
    {
      href: "/workspace/docs",
      label: "자료실",
      hint: `문서 ${scenario.documents.length}건`,
    },
    {
      href: "/workspace/offer",
      label: scenario.offerForm.title,
      hint: "제출하면 되돌릴 수 없음",
    },
    {
      href: "/workspace/report",
      label: "사후 리뷰",
      hint: `${scenario.scoring.axes.length}축 평가와 회신`,
    },
  ];

  return (
    <SessionProvider scenario={clientScenario}>
      {/* props는 화면에 그대로 찍을 값만 골라 넘긴다. scenario 전체를 넘기지 않는다. */}
      <Tutorial
        docCount={scenario.documents.length}
        offerFormTitle={scenario.offerForm.title}
        maxTurns={scenario.clock.maxTurns}
        minutesPerMessage={scenario.clock.minutesPerMessage}
        deadlineTime={scenario.clock.deadlineTime}
      />
      <div className="flex h-screen flex-col">
        <StageHeader companyName={company.name} />

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
            <StageNav items={items} />
            <div className="mx-3 my-1.5 h-px bg-line" aria-hidden />
            <TrustPanel />
            <div className="flex-1" />
            <div className="flex items-center gap-2 border-t border-line px-5 py-3">
              <Avatar name={scenario.player.name} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-ink">
                  {scenario.player.name}
                </div>
                <div className="truncate text-[10px] text-muted">
                  {scenario.player.team}
                  {scenario.player.tenure ? ` · ${scenario.player.tenure}` : ""}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
