"use client";

/**
 * 결과 리포트(AAR). 세션에 들어 있는 채점 결과를 그대로 렌더한다.
 *
 * 점수·상한·페널티는 서버에서 이미 확정돼서 온다. 이 화면은 계산하지 않는다.
 * 섹션의 순서와 제목도 시나리오 데이터가 정한 것이라 여기에 하드코딩하지 않는다.
 */

import Link from "next/link";
import { useEffect } from "react";

import type { AxisScore, ReportSection, TriggeredPenalty } from "@/lib/game/api";
import { useSession } from "@/lib/game/SessionProvider";
import { booleanValue, numberValue, textValue, type OfferValues } from "@/lib/game/offer";
import type { OfferForm } from "@/types/scenario";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-[18px]">
      <h2 className="text-xs font-extrabold text-ink">{title}</h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Prose({ text }: { text?: string }) {
  if (!text) return <p className="text-sm text-muted">내용을 받지 못했습니다.</p>;
  return (
    <div className="space-y-2.5">
      {text.split(/\n+/).map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-ink-soft">
          {p}
        </p>
      ))}
    </div>
  );
}

function ScoreBar({ axis }: { axis: AxisScore }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold text-ink">{axis.name}</span>
        <span className="font-mono text-sm font-bold text-ink tabular-nums">{axis.score}</span>
      </div>
      <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-sunken">
        <div
          className={[
            "h-full rounded-full transition-[width]",
            axis.cappedAt !== undefined ? "bg-urgent" : "bg-accent",
          ].join(" ")}
          style={{ width: `${axis.score}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{axis.comment}</p>
      {axis.cappedAt !== undefined ? (
        <p className="mt-1 text-xs font-semibold text-urgent">
          페널티로 {axis.cappedAt}점 상한이 적용되었습니다.
        </p>
      ) : null}
    </li>
  );
}

function Penalties({ penalties }: { penalties: TriggeredPenalty[] }) {
  if (!penalties.length) return null;
  return (
    <Card title="걸린 페널티">
      <ul className="space-y-3">
        {penalties.map((p) => (
          <li key={p.id} className="border-l-2 border-urgent pl-3">
            <p className="text-sm font-bold text-ink">{p.when}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{p.effect}</p>
            <p className="mt-1 text-[11px] text-muted">
              {p.judgedBy === "code" ? "규정 대조로 자동 판정" : "제출한 메시지를 검토해 판정"}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SectionCard({ section }: { section: ReportSection }) {
  if (section.kind === "bullets") {
    return (
      <Card title={section.title}>
        {section.bullets?.length ? (
          <ol className="space-y-2">
            {section.bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <span className="shrink-0 font-mono font-bold text-accent tabular-nums">
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">내용을 받지 못했습니다.</p>
        )}
      </Card>
    );
  }

  return (
    <Card title={section.title}>
      <Prose text={section.body} />
    </Card>
  );
}

function SubmittedOffer({ form, offer }: { form: OfferForm; offer: OfferValues }) {
  return (
    <Card title="제출한 오퍼">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {form.fields
          .filter((f) => f.type !== "textarea")
          .map((f) => (
            <div key={f.id} className="rounded-[10px] bg-sunken px-3.5 py-3">
              <div className="text-[10px] font-extrabold tracking-wide text-muted uppercase">
                {f.label}
              </div>
              <div className="mt-1 font-mono text-[15px] font-bold text-ink tabular-nums">
                {f.type === "boolean"
                  ? booleanValue(offer, f.id)
                    ? "적용"
                    : "미적용"
                  : `${numberValue(offer, f.id).toLocaleString("ko-KR")}${f.unit ? ` ${f.unit}` : ""}`}
              </div>
            </div>
          ))}
      </div>
      {form.fields
        .filter((f) => f.type === "textarea")
        .map((f) => (
          <div key={f.id} className="mt-4 border-t border-line pt-3">
            <p className="text-xs text-muted">{f.label}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {textValue(offer, f.id)}
            </p>
          </div>
        ))}
    </Card>
  );
}

export function Report({ form }: { form: OfferForm }) {
  const { state, hydrating, retryGrade, restart } = useSession();
  const { offer, report, grading, gradeError } = state;

  // 새로고침으로 채점 요청이 끊겼을 수 있다. 오퍼는 나갔는데 결과가 없으면 다시 채점한다.
  useEffect(() => {
    if (hydrating || !offer || report || grading || gradeError) return;
    void retryGrade();
  }, [hydrating, offer, report, grading, gradeError, retryGrade]);

  if (hydrating) {
    return <p className="mt-10 text-center text-sm text-muted">불러오는 중…</p>;
  }

  if (!offer) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">아직 오퍼를 제출하지 않았습니다.</p>
        <p className="mt-1 text-xs text-muted">
          제출해야 정하람님의 회신과 평가를 볼 수 있습니다.
        </p>
        <Link
          href="/workspace/offer"
          className="mt-4 inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          오퍼 작성으로
        </Link>
      </div>
    );
  }

  if (grading) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-bold text-ink">오퍼를 발송했습니다.</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          정하람님의 회신과 평가를 정리하는 중입니다. 30초쯤 걸립니다.
        </p>
      </div>
    );
  }

  if (!report || report.degraded) {
    return (
      <div className="mt-10 space-y-5">
        <div className="rounded-xl border border-urgent-border bg-urgent-soft p-5 text-center">
          <p className="text-sm font-bold text-urgent">
            {gradeError ?? "채점 결과를 끝까지 읽지 못했습니다."}
          </p>
          <p className="mt-1.5 text-xs text-ink-soft">
            오퍼는 이미 발송되었습니다. 채점만 다시 실행합니다.
          </p>
          <button
            type="button"
            onClick={() => void retryGrade()}
            className="mt-4 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            다시 채점
          </button>
        </div>
        {report ? <Penalties penalties={report.penalties} /> : null}
        <SubmittedOffer form={form} offer={offer} />
      </div>
    );
  }

  // 회신 섹션은 헤더에 붙여 따로 그린다. 나머지는 데이터 순서 그대로.
  const replySection = report.sections.find((s) => s.kind === "outcome");
  const restSections = report.sections.filter((s) => s !== replySection);

  // outcome은 시나리오의 aar.outcomeOptions에서 나온 문자열이라 고정된 팔레트로 매핑한다.
  const heroBg =
    report.outcome === "수락"
      ? "bg-success-text"
      : report.outcome === "거절"
        ? "bg-urgent"
        : "bg-primary";

  return (
    <div className="mt-8 space-y-5">
      {/* 회신 — 이 판의 결과다. 점수보다 먼저 온다. */}
      <section className={`rounded-xl ${heroBg} p-[18px] text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-white/70 uppercase">
              결과 리포트
            </p>
            <h2 className="mt-1.5 text-lg font-extrabold leading-snug">
              {replySection?.title ?? "회신"}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
            {report.outcome}
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {(replySection?.body ?? "").split(/\n+/).map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-white/85">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-[18px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted">종합</p>
            <p className="mt-0.5 font-mono text-3xl font-bold text-ink tabular-nums">
              {report.totalScore}
              <span className="ml-1 font-sans text-base font-medium text-muted">/ 100</span>
            </p>
          </div>
          {report.bandLabel ? (
            <div className="text-right">
              <p className="text-sm font-bold text-accent">{report.bandLabel}</p>
              <p className="mt-0.5 max-w-[16rem] text-xs leading-relaxed text-muted">
                {report.bandMeaning}
              </p>
            </div>
          ) : null}
        </div>

        <ul className="mt-6 space-y-5 border-t border-line pt-5">
          {report.axes.map((axis) => (
            <ScoreBar key={axis.axisId} axis={axis} />
          ))}
        </ul>
      </section>

      <Penalties penalties={report.penalties} />

      {restSections.map((s) => (
        <SectionCard key={s.id} section={s} />
      ))}

      <SubmittedOffer form={form} offer={offer} />

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={restart}
          className="rounded-[10px] border border-line-strong px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-sunken"
        >
          이 스테이지 다시 하기
        </button>
      </div>
    </div>
  );
}
