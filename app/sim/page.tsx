import Link from "next/link";

import { formatGameDate } from "@/lib/clock";
import { ACTIVE_SCENARIO_ID, listScenarios, loadCompany } from "@/lib/data";

export default function HomePage() {
  const scenarios = listScenarios();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
        HR Practice Simulator
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">HR 실무 시뮬레이터</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
        문제가 출제되지 않습니다. 상황이 메신저로 도착할 뿐입니다. 정보는 늘 부족하게 시작하고,
        되물어야 나옵니다. 정답은 없고 트레이드오프만 있습니다.
      </p>

      <ul className="mt-10 space-y-3">
        {scenarios.map((scenario) => {
          const company = loadCompany(scenario.companyId);
          const isActive = scenario.id === ACTIVE_SCENARIO_ID;

          return (
            <li key={scenario.id}>
              <div className="rounded-lg border border-line bg-surface p-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="rounded bg-accent-soft px-2 py-0.5 font-semibold text-accent">
                    {scenario.track.name} {String(scenario.track.stage).padStart(2, "0")}
                  </span>
                  <span>{company.name}</span>
                  <span aria-hidden>·</span>
                  <span>{formatGameDate(scenario.today)}</span>
                  {scenario.estimatedMinutes ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>약 {scenario.estimatedMinutes}분</span>
                    </>
                  ) : null}
                </div>

                <h2 className="mt-3 text-xl font-semibold text-ink">{scenario.title}</h2>
                {scenario.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{scenario.summary}</p>
                ) : null}

                <div className="mt-5">
                  {isActive ? (
                    <Link
                      href="/workspace"
                      className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
                    >
                      출근하기
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-line bg-sunken px-4 py-2 text-sm font-medium text-muted">
                      준비 중
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
