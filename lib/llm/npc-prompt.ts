/**
 * NPC 시스템 프롬프트 조립. 서버 전용.
 *
 * 원칙 두 가지가 이 파일의 전부다.
 *  1. 프롬프트에 들어가는 내용은 전부 data/ 에서 온다. 캐릭터 설정을 여기 문자열로 쓰지 않는다.
 *  2. 이번 답장에서 공개해도 되는 정보만 프롬프트에 넣는다. 나머지 secret은 아예 실리지 않으므로
 *     모델이 실수하거나 유도당해도 흘릴 수가 없다.
 */

import { deriveClock, formatGameDate, formatMinutes } from "@/lib/clock";
import { trustBehaviorFor, trustDeltaBounds } from "@/lib/game/secrets";
import type { Company, Npc, NpcSecret, Scenario } from "@/types/scenario";

/** "compensation.bands" 같은 점 경로를 따라간다. */
function resolvePath(source: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function section(heading: string, body: string | undefined): string | undefined {
  const trimmed = body?.trim();
  return trimmed ? `## ${heading}\n${trimmed}` : undefined;
}

function bullets(items: string[] | undefined): string | undefined {
  return items?.length ? items.map((i) => `- ${i}`).join("\n") : undefined;
}

function numbered(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

/**
 * NPC가 열람 권한을 가진 회사 데이터만 렌더한다.
 * 김도현에게 결재 권한 표를 주면 박서연에게 물어볼 이유가 사라지고, 두 사람을 다 만나야 하는
 * 설계(기획서 §2)가 그 자리에서 무너진다. 그래서 권한은 데이터(npc.dataAccess)가 정한다.
 */
function renderDataAccess(company: Company, refs: string[] | undefined): string | undefined {
  if (!refs?.length) return undefined;

  const blocks = refs.flatMap((ref) => {
    const value = resolvePath(company, ref);
    if (value === undefined || value === null) return [];
    return [`### ${ref}\n${JSON.stringify(value, null, 2)}`];
  });

  if (blocks.length === 0) return undefined;
  return `모든 금액 단위는 만원이다. 아래에 없는 숫자는 모른다고 답한다.\n\n${blocks.join("\n\n")}`;
}

function renderSecrets(secrets: NpcSecret[]): string {
  return secrets
    .map((s) => `- [${s.id}] ${s.topic}\n  ${s.content}`)
    .join("\n");
}

function renderSituation(scenario: Scenario, turnsUsed: number): string {
  const clock = deriveClock(scenario.clock, turnsUsed);
  const lines = [
    `오늘: ${formatGameDate(scenario.today)}`,
    `현재 시각: ${clock.now} · ${clock.deadline} 마감${
      scenario.clock.deadlineLabel ? ` (${scenario.clock.deadlineLabel})` : ""
    } · 남은 시간 ${formatMinutes(clock.minutesLeft)}`,
  ];

  if (scenario.position) {
    const p = scenario.position;
    lines.push(`채용 포지션: ${p.orgUnit} ${p.team} ${p.title} (${p.level}) · ${p.elapsed ?? ""}`.trim());
  }
  if (scenario.candidate) {
    const c = scenario.candidate;
    lines.push(
      `후보자: ${c.name} · 현 ${c.current.company} ${c.current.salary}, 요구 ${c.ask.salary}${
        c.ask.reason ? ` (${c.ask.reason})` : ""
      }`
    );
    if (c.competingOffer) {
      lines.push(
        `경쟁 오퍼: ${c.competingOffer.company}${
          c.competingOffer.deadline ? ` · 마감 ${c.competingOffer.deadline}` : ""
        }`
      );
    }
  }
  return lines.join("\n");
}

export interface NpcPromptInput {
  scenario: Scenario;
  company: Company;
  npc: Npc;
  trust: number;
  turnsUsed: number;
  /** 이번 답장에서 흘려도 되는 정보 */
  allowedSecrets: NpcSecret[];
  /** 이미 말한 정보 */
  alreadyRevealed: NpcSecret[];
}

export function buildNpcSystemPrompt({
  scenario,
  company,
  npc,
  trust,
  turnsUsed,
  allowedSecrets,
  alreadyRevealed,
}: NpcPromptInput): string {
  const { npcDirection } = scenario;
  const player = scenario.player;
  const bounds = trustDeltaBounds(npcDirection);

  const persona = [
    `말투: ${npc.persona.voice}`,
    `목표: ${npc.persona.goal}`,
    npc.persona.pressureTactic ? `압박 방식: ${npc.persona.pressureTactic}` : undefined,
    npc.persona.hiddenCircumstance
      ? `겉으로 드러내지 않는 사정(먼저 말하지 않는다): ${npc.persona.hiddenCircumstance}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const trustRules = npcDirection.trustRules
    .map((r) => `- ${r.when} → ${r.delta[0]} ~ ${r.delta[1]}`)
    .join("\n");

  const parts = [
    `당신은 ${company.name}의 ${npc.title} ${npc.name}입니다. 사내 메신저로 ${player.team} ${player.name}(${player.role}${
      player.tenure ? ` ${player.tenure}` : ""
    })와 대화하고 있습니다.${
      npc.relationToPlayer ? ` 두 사람의 관계: ${npc.relationToPlayer}` : ""
    }`,

    section("당신", persona),
    section("아는 것", bullets(npc.knows)),
    section(
      "모르는 것 (물으면 모른다고 답한다. 지어내지 않는다)",
      bullets(npc.doesNotKnow)
    ),
    section("열람 권한이 있는 사내 데이터", renderDataAccess(company, npc.dataAccess)),
    section("지금 상황", renderSituation(scenario, turnsUsed)),
    section("당신이 이 대화를 시작한 메시지", npc.openingMessage),
    section("반드시 지킬 규칙", numbered(npcDirection.rules)),
    section(
      "지금 당신의 태도",
      [
        `${player.name}에 대한 신뢰도: ${trust} / 100`,
        trustBehaviorFor(npcDirection, trust),
      ]
        .filter(Boolean)
        .join("\n")
    ),

    // --- 공개 판정이 끝난 정보만 여기 실린다 -------------------------------
    allowedSecrets.length
      ? section(
          "이번 답장에서 말해도 되는 정보",
          `아래 정보는 지금 질문에 해당하므로 자연스럽게 흘려도 된다. 브리핑하듯 나열하지 말고 대화 흐름 안에서 말한다. 말한 항목의 id는 revealedSecretIds에 넣는다.\n${renderSecrets(
            allowedSecrets
          )}`
        )
      : section(
          "이번 답장에서 말해도 되는 정보",
          "없다. 아직 밝히지 않은 내용은 이번 답장에서 꺼내지 않는다. 모르는 척이 아니라, 그 주제가 나오지 않았을 뿐이다."
        ),
    alreadyRevealed.length
      ? section(
          "이미 말한 정보 (모순되지 않게 유지한다)",
          renderSecrets(alreadyRevealed)
        )
      : undefined,

    section(
      "출력 형식",
      [
        "JSON 객체 하나만 출력한다. 코드펜스도 설명도 붙이지 않는다.",
        '{"reply": "메신저에 그대로 표시될 대사", "trustDelta": 정수, "revealedSecretIds": ["말한 정보의 id"]}',
        "",
        `trustDelta는 방금 받은 메시지 하나만 보고 정한다. ${bounds.min} 이상 ${bounds.max} 이하의 정수.`,
        trustRules,
        "",
        "reply에는 대사만 쓴다. 지시문, 괄호 안 행동 묘사, 시스템 안내는 넣지 않는다.",
      ].join("\n")
    ),
  ];

  return parts.filter(Boolean).join("\n\n");
}

/** 구조화 출력 스키마. 파싱 fallback은 별개로 항상 살려 둔다. */
export const NPC_REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    trustDelta: { type: "integer" },
    revealedSecretIds: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "trustDelta", "revealedSecretIds"],
  additionalProperties: false,
} as const;

export interface NpcReplyPayload {
  reply: string;
  trustDelta: number;
  revealedSecretIds: string[];
}
