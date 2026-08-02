import { OfferForm } from "@/components/offer/OfferForm";
import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default function OfferPage() {
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);
  const { offerForm, candidate } = scenario;

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <p className="text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">
        오퍼 승인 요청서
      </p>
      <h1 className="mt-1.5 text-[22px] font-extrabold tracking-tight text-ink">
        {offerForm.title}
      </h1>
      {offerForm.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{offerForm.description}</p>
      ) : null}

      {candidate ? (
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-[10px] bg-sunken px-3.5 py-3">
            <div className="text-[10px] font-extrabold tracking-wide text-muted uppercase">
              후보자
            </div>
            <div className="mt-1 truncate text-sm font-bold text-ink">{candidate.name}</div>
          </div>
          <div className="rounded-[10px] bg-sunken px-3.5 py-3">
            <div className="text-[10px] font-extrabold tracking-wide text-muted uppercase">
              현 연봉
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-ink tabular-nums">
              {candidate.current.salary.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-[10px] bg-sunken px-3.5 py-3">
            <div className="text-[10px] font-extrabold tracking-wide text-muted uppercase">
              요구 연봉
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-urgent tabular-nums">
              {candidate.ask.salary.toLocaleString("ko-KR")}
            </div>
          </div>
        </div>
      ) : null}

      {/* offerForm에는 숨은 정보가 없다. scoring·secrets는 여기로 넘어가지 않는다. */}
      <OfferForm form={offerForm} />
    </div>
  );
}
