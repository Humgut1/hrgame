/**
 * 채점 프록시. Anthropic 호출은 오직 라우트 핸들러에서만 일어난다. (CLAUDE.md 절대 규칙)
 *
 * /api/npc 와 같은 구조다. 모델은 **문장을 쓰고**, 판정은 코드가 한다.
 *  - 오퍼 값 검증을 서버가 다시 한다 (클라이언트 폼 검증은 UX용이다)
 *  - 밴드 초과·전결 한도 초과·미열람·단독 대화 페널티를 코드가 판정한다
 *  - 모델이 돌려준 축 점수를 0~100 정수로 자르고, 페널티 상한(capAt)을 코드가 다시 씌운다
 *  - 총점과 등급은 모델에게 묻지 않는다. 축 점수와 가중치로 계산한다
 */

import { NextResponse } from "next/server";

import { loadStage } from "@/lib/data";
import type {
  ApiErrorBody,
  AxisScore,
  GradeReport,
  GradeRequest,
  ReportSection,
  TriggeredPenalty,
} from "@/lib/game/api";
import {
  bandForScore,
  capForAxis,
  detectPenalties,
  validateOffer,
  weightedTotal,
  type OfferValues,
} from "@/lib/game/offer";
import {
  anthropic,
  describeApiError,
  GRADE_MODEL,
  parseJsonLoose,
  textOf,
} from "@/lib/llm/anthropic";
import {
  buildGradeSystemPrompt,
  buildGradeUserMessage,
  gradeSchema,
  type GradePayload,
} from "@/lib/llm/grade-prompt";
import type { Penalty, Scenario } from "@/types/scenario";

/** AAR 6개 섹션 전문. 넉넉하게 잡는다 — 잘린 JSON은 통째로 못 읽는다. */
const MAX_TOKENS = 16000;
/** 축 점수를 받지 못했을 때. 채점 기조상 기본값은 50점대다. */
const MISSING_AXIS_SCORE = 50;

function bad(status: number, error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status });
}

function isValidRequest(body: unknown): body is GradeRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.scenarioId === "string" &&
    typeof b.turnsUsed === "number" &&
    !!b.offer &&
    typeof b.offer === "object" &&
    Array.isArray(b.readDocIds) &&
    Array.isArray(b.npcs)
  );
}

// ---------------------------------------------------------------------------
// 모델 응답 정리 — 여기부터는 전부 코드가 정한다
// ---------------------------------------------------------------------------

function clampScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return MISSING_AXIS_SCORE;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** 축 점수에 페널티 상한을 씌운다. 자료를 안 읽었으면 모델이 100을 줘도 40이 된다. */
function buildAxes(
  scenario: Scenario,
  payload: GradePayload | undefined,
  triggered: Penalty[]
): AxisScore[] {
  return scenario.scoring.axes.map((axis) => {
    const found = payload?.axes?.find((a) => a.axisId === axis.id);
    const raw = clampScore(found?.score);
    const cap = capForAxis(axis.id, triggered);
    const score = cap !== undefined ? Math.min(raw, cap) : raw;

    return {
      axisId: axis.id,
      name: axis.name,
      score,
      comment:
        typeof found?.comment === "string" && found.comment.trim()
          ? found.comment.trim()
          : "채점 근거를 받지 못했습니다.",
      ...(cap !== undefined && raw > cap ? { cappedAt: cap } : {}),
    };
  });
}

/** aar.sections 순서를 코드가 강제한다. scores는 axes로 렌더하므로 여기서 뺀다. */
function buildSections(
  scenario: Scenario,
  payload: GradePayload | undefined
): ReportSection[] {
  return scenario.aar.sections
    .filter((s) => s.kind !== "scores")
    .map((s) => {
      const found = payload?.sections?.find((x) => x.id === s.id);
      const bullets = Array.isArray(found?.bullets)
        ? found.bullets.filter((b): b is string => typeof b === "string" && !!b.trim())
        : undefined;

      return {
        id: s.id,
        title: s.title,
        kind: s.kind,
        body: typeof found?.body === "string" ? found.body.trim() : undefined,
        bullets:
          s.kind === "bullets" && bullets
            ? bullets.slice(0, s.bulletCount ?? bullets.length)
            : bullets,
      };
    });
}

function toTriggered(penalties: Penalty[], judgedBy: "code" | "model"): TriggeredPenalty[] {
  return penalties.map((p) => ({ id: p.id, when: p.when, effect: p.effect, judgedBy }));
}

// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad(400, "요청 형식이 올바르지 않습니다.");
  }
  if (!isValidRequest(body)) return bad(400, "요청 형식이 올바르지 않습니다.");

  let scenario, company;
  try {
    ({ scenario, company } = loadStage(body.scenarioId));
  } catch {
    return bad(404, "시나리오를 찾을 수 없습니다.");
  }

  // 폼 검증은 서버도 다시 한다. 클라이언트 검증은 UX일 뿐 규칙이 아니다.
  const offer = body.offer as OfferValues;
  const errors = validateOffer(scenario.offerForm, offer);
  if (errors.length) return bad(400, errors[0].message);

  // NPC별 기록은 시나리오에 있는 사람만 남긴다.
  const npcRecords = body.npcs.filter((n) =>
    scenario.npcs.some((s) => s.id === n.npcId)
  );
  const readDocIds = body.readDocIds.filter((id) =>
    scenario.documents.some((d) => d.id === id)
  );
  const talkedToNpcIds = npcRecords
    .filter((n) => n.messages.some((m) => m.from === "player"))
    .map((n) => n.npcId);

  // --- 페널티 판정. 모델을 부르기 전에 끝난다 -------------------------------
  const codePenalties = detectPenalties(scenario, company, offer, {
    readDocIds,
    talkedToNpcIds,
  });

  const system = buildGradeSystemPrompt(scenario, company);
  const userMessage = buildGradeUserMessage(scenario, {
    offer,
    turnsUsed: body.turnsUsed,
    readDocIds,
    npcs: npcRecords,
    codePenalties,
  });

  let payload: GradePayload | undefined;
  try {
    // 출력이 길다. 스트리밍으로 받아야 요청 타임아웃에 걸리지 않는다.
    const response = await anthropic()
      .messages.stream({
        model: GRADE_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: userMessage }],
        output_config: {
          // 채점은 진짜 추론이다. NPC 대사(effort: low)와 반대쪽 끝에 둔다.
          effort: "high",
          format: { type: "json_schema", schema: gradeSchema(scenario) },
        },
      })
      .finalMessage();

    if (response.stop_reason === "refusal") {
      return bad(422, "이 내용은 채점할 수 없습니다. 메시지를 고쳐서 다시 제출해 주세요.");
    }

    payload = parseJsonLoose<GradePayload>(textOf(response));
  } catch (error) {
    console.error("[api/grade]", error);
    return bad(502, describeApiError(error));
  }

  // --- 응답을 못 읽어도 코드가 판정한 것은 돌려준다 (파싱 fallback) ---------
  const modelPenalties = payload
    ? (scenario.scoring.penalties ?? []).filter(
        (p) => !p.detect && payload.penaltyIds?.includes(p.id)
      )
    : [];
  const triggered = [...codePenalties, ...modelPenalties];

  const penalties = [
    ...toTriggered(codePenalties, "code"),
    ...toTriggered(modelPenalties, "model"),
  ];

  // 읽지 못했으면 점수를 지어내지 않는다. 코드가 판정한 페널티만 담아 보내고 다시 채점하게 한다.
  if (!payload) {
    return NextResponse.json<GradeReport>({
      scenarioId: scenario.id,
      outcome: "",
      totalScore: 0,
      axes: [],
      sections: [],
      penalties,
      degraded: true,
    });
  }

  const axes = buildAxes(scenario, payload, triggered);
  const totalScore = weightedTotal(axes, scenario);
  const band = bandForScore(scenario, totalScore);

  const outcomeOptions = scenario.aar.outcomeOptions ?? [];
  const outcome = outcomeOptions.includes(payload.outcome)
    ? payload.outcome
    : (outcomeOptions[outcomeOptions.length - 1] ?? "보류");

  return NextResponse.json<GradeReport>({
    scenarioId: scenario.id,
    outcome,
    totalScore,
    bandLabel: band?.label,
    bandMeaning: band?.meaning,
    axes,
    sections: buildSections(scenario, payload),
    penalties,
  });
}
