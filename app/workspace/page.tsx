import { BriefingActions } from "@/components/workspace/BriefingActions";
import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default function BriefingPage() {
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);
  const { briefing } = scenario;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-accent uppercase">
        상황 브리핑
      </p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-ink">
        {briefing.headline}
      </h1>

      <div className="mt-7 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 text-xs font-extrabold tracking-tight text-ink">
          지금까지 확인된 사실
        </div>
        <ol className="px-4">
          {briefing.situation.map((line, i) => (
            <li
              key={i}
              className={[
                "flex gap-3 py-2.5",
                i < briefing.situation.length - 1 ? "border-b border-line/70" : "",
              ].join(" ")}
            >
              <span className="shrink-0 pt-px font-mono text-xs font-bold text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-relaxed text-ink-soft">{line}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft p-5">
        <h2 className="text-xs font-extrabold tracking-wide text-accent">오늘 해야 하는 일</h2>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ink">{briefing.objective}</p>
      </div>

      {briefing.constraints?.length ? (
        <div className="mt-4 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-xs font-extrabold tracking-wide text-muted">제약</h2>
          <ul className="mt-2 space-y-1.5">
            {briefing.constraints.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BriefingActions />
    </div>
  );
}
