import { Report } from "@/components/report/Report";
import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default function ReportPage() {
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-accent uppercase">
        사후 리뷰
      </p>
      <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-ink">
        {scenario.title}
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">이 판에서 실제로 무슨 일이 벌어졌는지 봅니다.</p>

      {/* offerForm은 제출값을 라벨과 함께 보여주기 위한 것이다. scoring은 넘기지 않는다. */}
      <Report form={scenario.offerForm} />
    </div>
  );
}
