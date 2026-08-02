/**
 * 채점 프롬프트 조립. 서버 전용.
 *
 * npc-prompt.ts 와 반대 방향의 파일이다. 저기서는 정보를 **가려서** 넣었고, 여기서는 전부 넣는다.
 * 판이 끝났으므로 숨길 것이 없고, 채점관은 회사 데이터 전체와 모범 해법을 보고 판단해야 한다.
 *
 * 다만 **페널티 판정은 여기서 하지 않는다.** 코드가 이미 판정한 결과를 사실로 적어 주고,
 * 문장을 읽어야만 알 수 있는 페널티만 모델에게 판정을 맡긴다. (lib/game/offer.ts)
 */

import { deriveClock, formatGameDate } from "@/lib/clock";
import type { OfferValues } from "@/lib/game/offer";
import { booleanValue, numberValue, textValue } from "@/lib/game/offer";
import type {
  Company,
  Npc,
  Penalty,
  Scenario,
  ScoringAxis,
} from "@/types/scenario";

function section(heading: string, body: string | undefined): string | undefined {
  const trimmed = body?.trim();
  return trimmed ? `## ${heading}\n${trimmed}` : undefined;
}

function bullets(items: (string | undefined)[]): string {
  return items.filter(Boolean).map((i) => `- ${i}`).join("\n");
}

// ---------------------------------------------------------------------------
// 시스템 프롬프트 — 채점 기준. 판마다 바뀌지 않는다.
// ---------------------------------------------------------------------------

function renderAxis(axis: ScoringAxis): string {
  const lines = [`### [${axis.id}] ${axis.name}`, axis.criteria];
  if (axis.looksLike?.high?.length) {
    lines.push(`높은 점수의 모습:\n${bullets(axis.looksLike.high)}`);
  }
  if (axis.looksLike?.low?.length) {
    lines.push(`낮은 점수의 모습:\n${bullets(axis.looksLike.low)}`);
  }
  return lines.join("\n");
}

/** 모델이 판정해야 하는 페널티만 보여준다. 코드가 판정하는 것은 결과만 사실로 넘어간다. */
function renderModelJudgedPenalties(penalties: Penalty[]): string | undefined {
  const list = penalties.filter((p) => !p.detect);
  if (!list.length) return undefined;

  return [
    "아래 항목은 플레이어가 쓴 문장을 읽어야만 판정할 수 있다. 해당하면 penaltyIds에 id를 넣고 총평에서 지적한다.",
    ...list.map((p) => `- [${p.id}] ${p.when} → ${p.effect}`),
  ].join("\n");
}

function renderAarSections(scenario: Scenario): string {
  return scenario.aar.sections
    .map((s) => {
      const shape =
        s.kind === "bullets"
          ? `bullets 배열${s.bulletCount ? ` (정확히 ${s.bulletCount}개)` : ""}`
          : s.kind === "scores"
            ? "axes 배열로 대신한다. sections에는 넣지 않는다"
            : "body 문자열";
      return `### [${s.id}] ${s.title} — ${shape}\n${s.instruction ?? ""}`.trim();
    })
    .join("\n\n");
}

export function buildGradeSystemPrompt(scenario: Scenario, company: Company): string {
  const rubric = scenario.scoring.rubricBands
    ?.map((b) => `- ${b.min}점 이상 · ${b.label} — ${b.meaning}`)
    .join("\n");

  const solution = scenario.scoring.modelSolution;
  const modelSolution = solution
    ? [
        solution.summary,
        solution.components?.length ? bullets(solution.components) : undefined,
        solution.rationale,
        solution.disclaimer ? `주의: ${solution.disclaimer}` : undefined,
      ]
        .filter(Boolean)
        .join("\n\n")
    : undefined;

  const parts = [
    `당신은 ${company.name}의 HR 실무를 가르치는 채점관입니다. 방금 끝난 판을 평가해 사후 리뷰(AAR)를 씁니다.`,
    "판단은 이미 끝났고 되돌릴 수 없습니다. 위로하거나 다독이지 말고, 실무에서 무슨 일이 벌어졌을지를 사실대로 씁니다.",

    section("채점 기조", scenario.scoring.strictness),
    section("점수 구간", rubric),
    section("평가 축", scenario.scoring.axes.map(renderAxis).join("\n\n")),
    section("모범 해법 (기준일 뿐 유일한 정답이 아니다)", modelSolution),
    section("당신이 직접 판정할 페널티", renderModelJudgedPenalties(scenario.scoring.penalties ?? [])),
    section(
      "회사 마스터 데이터 (모든 금액 단위: 만원)",
      JSON.stringify(
        {
          compensation: company.compensation,
          employees: company.employees,
          teams: company.teams,
        },
        null,
        2
      )
    ),
    section("작성할 섹션", renderAarSections(scenario)),

    section(
      "출력 형식",
      [
        "JSON 객체 하나만 출력한다. 코드펜스도 설명도 붙이지 않는다.",
        "{",
        `  "outcome": ${JSON.stringify(scenario.aar.outcomeOptions ?? [])} 중 하나,`,
        '  "axes": [{"axisId": "축 id", "score": 0~100 정수, "comment": "그 점수의 근거"}],',
        '  "sections": [{"id": "섹션 id", "body": "본문"} 또는 {"id": "섹션 id", "bullets": ["줄1", "줄2"]}],',
        '  "penaltyIds": ["해당하는 페널티 id"]',
        "}",
        "",
        "axes에는 평가 축 전부를 넣는다. sections에는 scores를 뺀 나머지 섹션 전부를 지시한 순서대로 넣는다.",
        "코멘트와 본문은 플레이어의 실제 문장·행동을 인용해서 쓴다. 일반론은 쓰지 않는다.",
        `읽는 사람은 ${scenario.player.name}(${scenario.player.role}) 본인이다. 3인칭 "플레이어"로 부르지 말고 2인칭으로 직접 말한다.`,
      ].join("\n")
    ),
  ];

  return parts.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// 유저 메시지 — 이번 판의 기록
// ---------------------------------------------------------------------------

export interface GradePlayRecord {
  offer: OfferValues;
  turnsUsed: number;
  readDocIds: string[];
  npcs: {
    npcId: string;
    trust: number;
    messages: { from: "npc" | "player"; text: string }[];
  }[];
  /** 코드가 이미 판정한 페널티. 모델은 이걸 다시 판정하지 않는다. */
  codePenalties: Penalty[];
}

function renderOffer(scenario: Scenario, offer: OfferValues): string {
  return scenario.offerForm.fields
    .map((f) => {
      if (f.type === "boolean") {
        return `- ${f.label}: ${booleanValue(offer, f.id) ? "예" : "아니오"}`;
      }
      if (f.type === "number") {
        const n = numberValue(offer, f.id);
        return `- ${f.label}: ${n.toLocaleString("ko-KR")}${f.unit ? ` ${f.unit}` : ""}`;
      }
      return `- ${f.label}:\n"""\n${textValue(offer, f.id)}\n"""`;
    })
    .join("\n");
}

function renderConversation(npc: Npc, record: GradePlayRecord["npcs"][number]): string {
  const sent = record.messages.filter((m) => m.from === "player").length;
  const head = `### ${npc.name} (${npc.title}) — 최종 신뢰도 ${record.trust} / 100 (시작 ${npc.initialTrust}), 플레이어가 보낸 메시지 ${sent}건`;

  if (sent === 0) {
    return `${head}\n플레이어는 이 사람에게 한 번도 말을 걸지 않았다.`;
  }
  const log = record.messages
    .map((m) => `${m.from === "player" ? "플레이어" : npc.name}: ${m.text}`)
    .join("\n");
  return `${head}\n${log}`;
}

function renderDocsRead(scenario: Scenario, readDocIds: string[]): string {
  const read = scenario.documents.filter((d) => readDocIds.includes(d.id));
  const unread = scenario.documents.filter((d) => !readDocIds.includes(d.id));

  return [
    `열람함 ${read.length} / ${scenario.documents.length}건`,
    read.length ? `읽은 문서: ${read.map((d) => d.title).join(", ")}` : "읽은 문서: 없음",
    unread.length ? `열지 않은 문서: ${unread.map((d) => d.title).join(", ")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGradeUserMessage(
  scenario: Scenario,
  record: GradePlayRecord
): string {
  const clock = deriveClock(scenario.clock, record.turnsUsed);

  const parts = [
    section(
      "이번 판",
      [
        `날짜: ${formatGameDate(scenario.today)} · 오퍼 발송 시각 ${clock.now} (마감 ${clock.deadline})`,
        `사용한 메시지: ${record.turnsUsed} / ${scenario.clock.maxTurns}건`,
      ].join("\n")
    ),
    section("자료실 열람", renderDocsRead(scenario, record.readDocIds)),
    section(
      "대화 기록",
      scenario.npcs
        .map((npc) => {
          const r = record.npcs.find((x) => x.npcId === npc.id);
          return r
            ? renderConversation(npc, r)
            : `### ${npc.name} (${npc.title})\n플레이어는 이 사람에게 한 번도 말을 걸지 않았다.`;
        })
        .join("\n\n")
    ),
    section("제출한 오퍼", renderOffer(scenario, record.offer)),

    // 판정이 끝난 사실이다. 모델에게 다시 확인시키지 않는다.
    record.codePenalties.length
      ? section(
          "이미 확정된 페널티 (규정 대조로 판정 완료 — 반드시 점수와 총평에 반영한다)",
          record.codePenalties.map((p) => `- ${p.when} → ${p.effect}`).join("\n")
        )
      : section("이미 확정된 페널티", "없다. 밴드·전결 한도·TO 관련 규정 위반은 발견되지 않았다."),

    "위 기록을 근거로 채점하고 AAR을 작성하라. JSON 객체 하나만 출력한다.",
  ];

  return parts.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// 구조화 출력 스키마 — 선택지는 데이터에서 온다
// ---------------------------------------------------------------------------

export function gradeSchema(scenario: Scenario) {
  return {
    type: "object",
    properties: {
      outcome: {
        type: "string",
        ...(scenario.aar.outcomeOptions?.length
          ? { enum: scenario.aar.outcomeOptions }
          : {}),
      },
      axes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            axisId: { type: "string", enum: scenario.scoring.axes.map((a) => a.id) },
            score: { type: "integer", minimum: 0, maximum: 100 },
            comment: { type: "string" },
          },
          required: ["axisId", "score", "comment"],
          additionalProperties: false,
        },
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: scenario.aar.sections.map((s) => s.id) },
            body: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
      penaltyIds: { type: "array", items: { type: "string" } },
    },
    required: ["outcome", "axes", "sections", "penaltyIds"],
    additionalProperties: false,
  } as const;
}

export interface GradePayload {
  outcome: string;
  axes: { axisId: string; score: number; comment: string }[];
  sections: { id: string; body?: string; bullets?: string[] }[];
  penaltyIds: string[];
}
