/**
 * 오퍼 검증과 페널티 판정. 순수 함수만 둔다 — 클라이언트 폼과 채점 라우트가 같이 쓴다.
 *
 * 3단계의 secrets.ts와 같은 원칙이다. **페널티는 코드가 판정한다.**
 * "밴드를 넘었으면 감점해 줘"라고 프롬프트로 부탁하면 모델 기분에 따라 걸리기도 하고 안 걸리기도 한다.
 * 넘었는지 여부는 숫자 비교로 끝나는 일이므로 코드가 정하고, 모델에게는 판정 결과를 사실로 준다.
 * 문장을 읽어야만 알 수 있는 페널티(detect 없는 것)만 모델이 판정한다.
 *
 * 임계값은 전부 회사 마스터 데이터에서 읽는다. 7800·3000 같은 숫자를 여기 적지 않는다.
 */

import type {
  Company,
  OfferField,
  OfferForm,
  Penalty,
  Scenario,
} from "@/types/scenario";

export type OfferValue = string | number | boolean;
export type OfferValues = Record<string, OfferValue>;

/** 페널티 판정에 필요한 세션 요약. 대화 로그 전체가 아니라 결론만 넘긴다. */
export interface PlaySummary {
  /** 열람한 문서 id */
  readDocIds: string[];
  /** 실제로 메시지를 보낸 NPC id (전송 실패 건은 빠진다) */
  talkedToNpcIds: string[];
}

// ---------------------------------------------------------------------------
// 값 읽기
// ---------------------------------------------------------------------------

export function numberValue(values: OfferValues, fieldId: string): number {
  const raw = values[fieldId];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function booleanValue(values: OfferValues, fieldId: string): boolean {
  return values[fieldId] === true;
}

export function textValue(values: OfferValues, fieldId: string): string {
  const raw = values[fieldId];
  return typeof raw === "string" ? raw.trim() : "";
}

// ---------------------------------------------------------------------------
// 검증 — 폼 정의(offerForm.fields)가 규칙의 유일한 출처다
// ---------------------------------------------------------------------------

export interface FieldError {
  fieldId: string;
  message: string;
}

/** 라벨은 데이터에서 오므로 조사를 고정할 수 없다. 받침 유무로 골라 붙인다. */
function particle(label: string, withFinal: string, withoutFinal: string): string {
  const last = label.trim().slice(-1).charCodeAt(0);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangul) return withoutFinal;
  return (last - 0xac00) % 28 !== 0 ? withFinal : withoutFinal;
}

const objectParticle = (label: string) => particle(label, "을", "를");
const topicParticle = (label: string) => particle(label, "은", "는");

function validateField(field: OfferField, values: OfferValues): string | undefined {
  const raw = values[field.id];

  if (field.type === "boolean") return undefined;

  if (field.type === "number") {
    const empty = raw === undefined || raw === "" || raw === null;
    if (empty) {
      return field.required
        ? `${field.label}${objectParticle(field.label)} 입력하세요.`
        : undefined;
    }

    const parsed = typeof raw === "number" ? raw : Number(raw);
    const topic = topicParticle(field.label);
    if (!Number.isFinite(parsed)) return `${field.label}${topic} 숫자여야 합니다.`;
    if (field.min !== undefined && parsed < field.min) {
      return `${field.label}${topic} ${field.min.toLocaleString("ko-KR")} 이상이어야 합니다.`;
    }
    if (field.max !== undefined && parsed > field.max) {
      return `${field.label}${topic} ${field.max.toLocaleString("ko-KR")} 이하여야 합니다.`;
    }
    return undefined;
  }

  // textarea
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return field.required
      ? `${field.label}${objectParticle(field.label)} 작성하세요.`
      : undefined;
  }
  if (field.minLength !== undefined && text.length < field.minLength) {
    return `${field.label}${topicParticle(field.label)} ${field.minLength}자 이상 써야 합니다. (현재 ${text.length}자)`;
  }
  return undefined;
}

export function validateOffer(form: OfferForm, values: OfferValues): FieldError[] {
  return form.fields.flatMap((field) => {
    const message = validateField(field, values);
    return message ? [{ fieldId: field.id, message }] : [];
  });
}

// ---------------------------------------------------------------------------
// 페널티 판정
// ---------------------------------------------------------------------------

/** 이 페널티를 코드가 판정하는가. 아니면 채점 LLM이 문장을 읽고 판정한다. */
export function isCodeJudged(penalty: Penalty): boolean {
  return penalty.detect !== undefined;
}

function bandMaxFor(scenario: Scenario, company: Company): number | undefined {
  const level = scenario.position?.level;
  if (!level) return undefined;
  return company.compensation.bands.find((b) => b.level === level)?.max;
}

function approvalLimit(company: Company, approvalId: string): number | undefined {
  return company.compensation.approvals.find((a) => a.id === approvalId)?.limitPerPerson;
}

/**
 * detect가 붙은 페널티만 판정한다. 판정할 수 없으면(임계값이 데이터에 없으면) 걸지 않는다 —
 * 근거 없이 감점하는 것보다 놓치는 편이 낫고, 그런 데이터는 validate-data가 먼저 막는다.
 */
export function detectPenalties(
  scenario: Scenario,
  company: Company,
  values: OfferValues,
  play: PlaySummary
): Penalty[] {
  const npcCount = scenario.npcs.length;

  return (scenario.scoring.penalties ?? []).filter((penalty) => {
    const d = penalty.detect;
    if (!d) return false;

    switch (d.kind) {
      case "booleanField":
        return d.field ? booleanValue(values, d.field) : false;

      case "exceedsBandMax": {
        const max = bandMaxFor(scenario, company);
        if (max === undefined || !d.field) return false;
        return numberValue(values, d.field) > max;
      }

      case "exceedsApprovalLimit": {
        if (!d.field || !d.approvalId) return false;
        const limit = approvalLimit(company, d.approvalId);
        if (limit === undefined) return false;
        return numberValue(values, d.field) > limit;
      }

      case "noDocumentsRead":
        return play.readDocIds.length === 0;

      // NPC가 1명뿐인 시나리오에서는 성립하지 않는 페널티다.
      case "singleNpcOnly":
        return npcCount > 1 && play.talkedToNpcIds.length < npcCount;
    }
  });
}

/**
 * 페널티의 capAt을 축 점수에 강제한다.
 * 모델이 아무리 후하게 줘도 자료를 안 읽었으면 데이터 근거성은 40을 넘지 못한다.
 */
export function capForAxis(axisId: string, penalties: Penalty[]): number | undefined {
  const caps = penalties
    .filter((p) => p.axisId === axisId && p.capAt !== undefined)
    .map((p) => p.capAt as number);
  return caps.length ? Math.min(...caps) : undefined;
}

// ---------------------------------------------------------------------------
// 총점
// ---------------------------------------------------------------------------

export function weightedTotal(
  axes: { axisId: string; score: number }[],
  scenario: Scenario
): number {
  const weightOf = (axisId: string) =>
    scenario.scoring.axes.find((a) => a.id === axisId)?.weight ?? 1;

  const totalWeight = axes.reduce((sum, a) => sum + weightOf(a.axisId), 0);
  if (totalWeight === 0) return 0;

  const sum = axes.reduce((acc, a) => acc + a.score * weightOf(a.axisId), 0);
  return Math.round(sum / totalWeight);
}

/** 총점이 속한 루브릭 구간. rubricBands는 min 내림차순이 아닐 수도 있으므로 정렬해서 찾는다. */
export function bandForScore(scenario: Scenario, score: number) {
  return [...(scenario.scoring.rubricBands ?? [])]
    .sort((a, b) => b.min - a.min)
    .find((b) => score >= b.min);
}
