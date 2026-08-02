/**
 * NPC 대화 프록시. Anthropic 호출은 오직 여기서만 일어난다. (CLAUDE.md 절대 규칙)
 *
 * 이 핸들러가 하는 일은 대사 생성 요청이 아니라 **판정**이다.
 *  - 턴이 남았는지 확인한다 (없으면 거절)
 *  - 신뢰도와 질문 내용으로 이번에 공개 가능한 정보를 계산한다
 *  - 그 정보만 프롬프트에 실어 모델을 부른다
 *  - 모델이 돌려준 trustDelta와 공개 목록을 데이터가 정한 범위로 자른다
 * 모델은 대사만 쓴다. 국면·턴·공개 여부는 전부 코드가 정한다.
 */

import { NextResponse } from "next/server";

import { loadStage } from "@/lib/data";
import type { ApiErrorBody, NpcTurnRequest, NpcTurnResponse } from "@/lib/game/api";
import { clampTrust, gateSecrets, trustDeltaBounds } from "@/lib/game/secrets";
import {
  anthropic,
  describeApiError,
  NPC_MODEL,
  parseJsonLoose,
  textOf,
} from "@/lib/llm/anthropic";
import {
  buildNpcSystemPrompt,
  NPC_REPLY_SCHEMA,
  type NpcReplyPayload,
} from "@/lib/llm/npc-prompt";
import type { Npc } from "@/types/scenario";

/** 대사 1~4문장. 넉넉히 잡되 thinking과 나눠 쓴다는 점을 감안한다. */
const MAX_TOKENS = 4000;
const MAX_MESSAGE_LENGTH = 1000;

function bad(status: number, error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status });
}

function isValidRequest(body: unknown): body is NpcTurnRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.scenarioId === "string" &&
    typeof b.npcId === "string" &&
    typeof b.trust === "number" &&
    typeof b.turnsUsed === "number" &&
    typeof b.message === "string" &&
    Array.isArray(b.revealedSecretIds) &&
    Array.isArray(b.history)
  );
}

/**
 * Anthropic 메시지 배열로 옮긴다.
 * 대화는 NPC의 인사말로 시작하는데 API는 첫 메시지가 user여야 하므로, 인사말은 여기서 빼고
 * 시스템 프롬프트에 넣는다. 그래서 첫 플레이어 발화 이전은 전부 잘라 낸다.
 */
function toApiMessages(
  history: NpcTurnRequest["history"],
  message: string
): { role: "user" | "assistant"; content: string }[] {
  const firstPlayer = history.findIndex((m) => m.from === "player");
  const trimmed = firstPlayer === -1 ? [] : history.slice(firstPlayer);

  return [
    ...trimmed.map((m) => ({
      role: m.from === "player" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    })),
    { role: "user" as const, content: message },
  ];
}

/** 모델이 침묵하거나 형식을 어겼을 때. 게임이 멈추지는 않게 한다. */
function fallbackReply(npc: Npc): NpcReplyPayload {
  return {
    reply: `(${npc.name}님이 답장을 쓰다 말았습니다. 다시 보내 주세요.)`,
    trustDelta: 0,
    revealedSecretIds: [],
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad(400, "요청 형식이 올바르지 않습니다.");
  }
  if (!isValidRequest(body)) return bad(400, "요청 형식이 올바르지 않습니다.");

  const message = body.message.trim();
  if (!message) return bad(400, "메시지가 비어 있습니다.");
  if (message.length > MAX_MESSAGE_LENGTH) {
    return bad(400, `메시지는 ${MAX_MESSAGE_LENGTH}자를 넘을 수 없습니다.`);
  }

  let scenario, company;
  try {
    ({ scenario, company } = loadStage(body.scenarioId));
  } catch {
    return bad(404, "시나리오를 찾을 수 없습니다.");
  }

  const npc = scenario.npcs.find((n) => n.id === body.npcId);
  if (!npc) return bad(404, "대화 상대를 찾을 수 없습니다.");

  // 턴은 서버도 다시 센다. 클라이언트 상태가 어긋나도 마감 규칙은 지켜진다.
  if (body.turnsUsed >= scenario.clock.maxTurns) {
    return bad(409, "오늘 쓸 수 있는 메시지를 모두 썼습니다.");
  }

  const trust = clampTrust(body.trust);
  const { allowed, alreadyRevealed } = gateSecrets({
    npc,
    trust,
    message,
    revealedIds: body.revealedSecretIds,
  });

  const system = buildNpcSystemPrompt({
    scenario,
    company,
    npc,
    trust,
    turnsUsed: body.turnsUsed,
    allowedSecrets: allowed,
    alreadyRevealed,
  });

  let payload: NpcReplyPayload;
  try {
    const response = await anthropic().messages.create({
      model: NPC_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: toApiMessages(body.history, message),
      output_config: {
        // 대사 생성은 어려운 추론이 아니다. 게임 진행 속도가 품질보다 중요하다.
        effort: "low",
        format: { type: "json_schema", schema: NPC_REPLY_SCHEMA },
      },
    });

    if (response.stop_reason === "refusal") {
      return bad(422, "이 메시지에는 답할 수 없습니다. 표현을 바꿔서 다시 보내 주세요.");
    }

    payload = parseJsonLoose<NpcReplyPayload>(textOf(response)) ?? fallbackReply(npc);
  } catch (error) {
    console.error("[api/npc]", error);
    return bad(502, describeApiError(error));
  }

  // --- 모델이 돌려준 값을 데이터가 정한 범위로 자른다 -----------------------
  const bounds = trustDeltaBounds(scenario.npcDirection);
  const trustDelta = Number.isFinite(payload.trustDelta)
    ? Math.max(bounds.min, Math.min(bounds.max, Math.round(payload.trustDelta)))
    : 0;

  const allowedIds = new Set(allowed.map((s) => s.id));
  const revealedSecretIds = Array.isArray(payload.revealedSecretIds)
    ? payload.revealedSecretIds.filter((id) => allowedIds.has(id))
    : [];

  const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";

  return NextResponse.json<NpcTurnResponse>({
    reply: reply || fallbackReply(npc).reply,
    trust: clampTrust(trust + trustDelta),
    trustDelta,
    revealedSecretIds,
  });
}
