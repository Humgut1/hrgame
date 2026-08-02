/**
 * 숨은 정보 공개 판정. 순수 함수만 둔다.
 *
 * 공개 여부는 **코드가 정한다.** LLM에게 "적절할 때 알려줘"라고 맡기지 않는다.
 * 판정에서 떨어진 정보는 프롬프트에 아예 실리지 않으므로, 모델이 흘리고 싶어도 흘릴 수가 없다.
 * (기획서 §2 — 진행은 상태머신이 소유하고 LLM은 대사만 생성한다)
 */

import type { Npc, NpcSecret, NpcDirection } from "@/types/scenario";

/** 한국어 띄어쓰기가 제각각이라 공백을 지우고 비교한다. "면접 후에" ⊃ "면접후" */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

export function matchesKeywords(message: string, keywords: string[]): boolean {
  const haystack = normalize(message);
  return keywords.some((k) => k.trim() !== "" && haystack.includes(normalize(k)));
}

export interface SecretGateInput {
  npc: Npc;
  /** 이 NPC에 대한 현재 신뢰도 0~100 */
  trust: number;
  /** 플레이어가 방금 보낸 메시지 */
  message: string;
  /** 이미 공개된 secret id 목록 */
  revealedIds: string[];
}

export interface SecretGateResult {
  /** 이번 답장에서 흘려도 되는 정보. 이것만 프롬프트에 들어간다. */
  allowed: NpcSecret[];
  /** 이미 말한 정보. 모순되지 않게 유지시키려고 프롬프트에 같이 넣는다. */
  alreadyRevealed: NpcSecret[];
}

export function gateSecrets({
  npc,
  trust,
  message,
  revealedIds,
}: SecretGateInput): SecretGateResult {
  const revealed = new Set(revealedIds);
  const allowed: NpcSecret[] = [];
  const alreadyRevealed: NpcSecret[] = [];

  for (const secret of npc.secrets ?? []) {
    if (revealed.has(secret.id)) {
      alreadyRevealed.push(secret);
      continue;
    }
    if (trust < secret.revealWhen.minTrust) continue;
    if (
      secret.revealWhen.requiresSpecificQuestion &&
      !matchesKeywords(message, secret.revealWhen.keywords)
    ) {
      continue;
    }
    allowed.push(secret);
  }

  return { allowed, alreadyRevealed };
}

/**
 * trustRules에 적힌 delta 범위의 합집합. LLM이 뱉은 trustDelta를 여기로 자른다.
 * 데이터가 -6~+5 라고 했으면 모델이 +40을 주장해도 +5까지만 반영된다.
 */
export function trustDeltaBounds(direction: NpcDirection): { min: number; max: number } {
  const deltas = direction.trustRules.flatMap((r) => r.delta);
  if (deltas.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...deltas), max: Math.max(...deltas) };
}

export function clampTrust(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 현재 신뢰도 구간에 해당하는 행동 지침 한 줄. */
export function trustBehaviorFor(
  direction: NpcDirection,
  trust: number
): string | undefined {
  return direction.trustBehavior?.find(
    (b) => trust >= (b.atLeast ?? 0) && trust < b.below
  )?.behavior;
}
