/**
 * 세션 상태와 리듀서. 순수 함수만 둔다 — 서버·클라이언트·테스트 어디서든 같은 결과를 낸다.
 *
 * 국면 전환·턴 소모·신뢰도 반영은 전부 여기서 일어난다.
 * LLM은 대사와 trustDelta 제안만 돌려주고, 그걸 상태에 어떻게 반영할지는 이 파일이 정한다.
 * (기획서 §2 · CLAUDE.md 절대 규칙)
 */

import { deriveClock, toHHMM, toMinutes } from "@/lib/clock";
import type { GradeReport } from "@/lib/game/api";
import type { OfferValues } from "@/lib/game/offer";
import type { ClientScenario, PhaseId } from "@/types/scenario";

export interface SessionMessage {
  id: string;
  from: "npc" | "player";
  text: string;
  /** 게임 내 시각 "HH:mm" */
  time: string;
  /** 플레이어 메시지에만. NPC가 답하면 true. */
  read?: boolean;
  /** 전송 실패로 남아 있는 말풍선 */
  failed?: boolean;
}

export interface NpcSession {
  trust: number;
  messages: SessionMessage[];
  revealedSecretIds: string[];
  /** 답장 대기 중 */
  pending: boolean;
  /** 마지막 전송 오류. 성공하면 지워진다. */
  error?: string;
}

export interface SessionState {
  scenarioId: string;
  phaseId: PhaseId;
  turnsUsed: number;
  npcs: Record<string, NpcSession>;
  /** 자료실에서 열람한 문서 id. 채점의 데이터 근거성 축에 쓰인다. */
  readDocIds: string[];
  /** 제출한 오퍼. 되돌릴 수 없으므로 한 번 들어오면 바뀌지 않는다. */
  offer?: OfferValues;
  /** 채점 결과. 채점에 실패해도 오퍼는 남는다 — 발송은 이미 끝났다. */
  report?: GradeReport;
  grading: boolean;
  /** 마지막 채점 오류. 다시 채점하면 지워진다. */
  gradeError?: string;
}

export type SessionAction =
  | { type: "ack_briefing" }
  | { type: "send"; npcId: string; text: string; messageId: string }
  | {
      type: "reply";
      npcId: string;
      messageId: string;
      text: string;
      trust: number;
      revealedSecretIds: string[];
    }
  | { type: "send_failed"; npcId: string; messageId: string; error: string }
  | { type: "retract"; npcId: string; messageId: string }
  | { type: "doc_read"; docId: string }
  | { type: "submit_offer"; offer: OfferValues }
  | { type: "grading" }
  | { type: "graded"; report: GradeReport }
  | { type: "grade_failed"; error: string };

// ---------------------------------------------------------------------------
// 초기 상태
// ---------------------------------------------------------------------------

export function initialSession(scenario: ClientScenario): SessionState {
  return {
    scenarioId: scenario.id,
    phaseId: "briefing",
    turnsUsed: 0,
    readDocIds: [],
    grading: false,
    npcs: Object.fromEntries(
      scenario.npcs.map((npc) => [
        npc.id,
        {
          trust: npc.initialTrust,
          revealedSecretIds: [],
          pending: false,
          messages: [
            {
              id: `${npc.id}-opening`,
              from: "npc" as const,
              text: npc.openingMessage,
              time: scenario.clock.startTime,
            },
          ],
        },
      ])
    ),
  };
}

/** 저장된 상태가 지금 시나리오와 맞는지. 어긋나면 새로 시작한다. */
export function isCompatible(state: SessionState, scenario: ClientScenario): boolean {
  if (state.scenarioId !== scenario.id) return false;
  return scenario.npcs.every((npc) => state.npcs[npc.id] !== undefined);
}

// ---------------------------------------------------------------------------
// 파생값
// ---------------------------------------------------------------------------

/** 턴을 다 쓰면 조사 국면은 끝난다. 국면 전환은 오직 여기서만 일어난다. */
function advancePhase(state: SessionState, scenario: ClientScenario): PhaseId {
  if (state.phaseId !== "investigate") return state.phaseId;
  return state.turnsUsed >= scenario.clock.maxTurns ? "decision" : "investigate";
}

/** turnsUsed 시점의 게임 내 시각 */
function timeAt(scenario: ClientScenario, turnsUsed: number): string {
  const { startTime, minutesPerMessage, maxTurns } = scenario.clock;
  const used = Math.min(Math.max(0, turnsUsed), maxTurns);
  return toHHMM(toMinutes(startTime) + used * minutesPerMessage);
}

export function canSendMessage(state: SessionState, scenario: ClientScenario): boolean {
  if (state.phaseId !== "investigate") return false;
  if (state.turnsUsed >= scenario.clock.maxTurns) return false;
  return !Object.values(state.npcs).some((n) => n.pending);
}

/** 왜 못 보내는지. UI가 그대로 보여준다. */
export function sendBlockedReason(
  state: SessionState,
  scenario: ClientScenario
): string | undefined {
  if (state.phaseId === "briefing") return "상황 브리핑을 먼저 확인하세요.";
  if (state.turnsUsed >= scenario.clock.maxTurns) {
    return `메시지를 모두 썼습니다. ${deriveClock(scenario.clock, state.turnsUsed).now} — 이제 오퍼를 확정해야 합니다.`;
  }
  if (state.phaseId !== "investigate") return "지금은 메시지를 보낼 수 없습니다.";
  if (Object.values(state.npcs).some((n) => n.pending)) return "답장을 기다리는 중입니다.";
  return undefined;
}

/** 오퍼는 조사·결정 국면에서만 낼 수 있고, 한 번 내면 끝이다. */
export function canSubmitOffer(state: SessionState): boolean {
  if (state.phaseId !== "investigate" && state.phaseId !== "decision") return false;
  if (state.offer || state.grading) return false;
  return !Object.values(state.npcs).some((n) => n.pending);
}

export function submitBlockedReason(state: SessionState): string | undefined {
  if (state.offer) return "오퍼는 이미 발송되었습니다. 되돌릴 수 없습니다.";
  if (state.grading) return "채점 중입니다.";
  if (state.phaseId === "briefing") return "상황 브리핑을 먼저 확인하세요.";
  if (Object.values(state.npcs).some((n) => n.pending)) return "답장을 기다리는 중입니다.";
  return undefined;
}

export function talkedToNpcIds(state: SessionState): string[] {
  return Object.entries(state.npcs)
    .filter(([, s]) => s.messages.some((m) => m.from === "player" && !m.failed))
    .map(([id]) => id);
}

// ---------------------------------------------------------------------------
// 리듀서
// ---------------------------------------------------------------------------

function patchNpc(
  state: SessionState,
  npcId: string,
  patch: (npc: NpcSession) => NpcSession
): SessionState {
  const current = state.npcs[npcId];
  if (!current) return state;
  return { ...state, npcs: { ...state.npcs, [npcId]: patch(current) } };
}

export function reduceSession(
  state: SessionState,
  action: SessionAction,
  scenario: ClientScenario
): SessionState {
  switch (action.type) {
    case "ack_briefing":
      return state.phaseId === "briefing" ? { ...state, phaseId: "investigate" } : state;

    case "send": {
      if (!canSendMessage(state, scenario)) return state;

      // 보낸 시각은 턴이 흐르기 전, 답장은 12분 뒤. 그래서 시각이 09:20 → 09:32 로 읽힌다.
      const sent = timeAt(scenario, state.turnsUsed);
      const next: SessionState = {
        ...state,
        turnsUsed: state.turnsUsed + 1,
        npcs: {
          ...state.npcs,
          [action.npcId]: {
            ...state.npcs[action.npcId],
            pending: true,
            error: undefined,
            messages: [
              ...state.npcs[action.npcId].messages,
              { id: action.messageId, from: "player", text: action.text, time: sent },
            ],
          },
        },
      };
      return { ...next, phaseId: advancePhase(next, scenario) };
    }

    case "reply": {
      const npc = state.npcs[action.npcId];
      if (!npc) return state;
      return patchNpc(state, action.npcId, (n) => ({
        ...n,
        pending: false,
        error: undefined,
        trust: action.trust,
        revealedSecretIds: Array.from(
          new Set([...n.revealedSecretIds, ...action.revealedSecretIds])
        ),
        messages: [
          ...n.messages.map((m) =>
            m.id === action.messageId ? { ...m, read: true } : m
          ),
          {
            id: `${action.messageId}-reply`,
            from: "npc" as const,
            text: action.text,
            time: timeAt(scenario, state.turnsUsed),
          },
        ],
      }));
    }

    // 네트워크·API 실패로 답장을 못 받았다. 턴은 돌려준다 — 플레이어 잘못이 아니다.
    case "send_failed": {
      const next = patchNpc(state, action.npcId, (n) => ({
        ...n,
        pending: false,
        error: action.error,
        messages: n.messages.map((m) =>
          m.id === action.messageId ? { ...m, failed: true } : m
        ),
      }));
      const turnsUsed = Math.max(0, next.turnsUsed - 1);
      const rolled = { ...next, turnsUsed };
      return {
        ...rolled,
        phaseId: rolled.phaseId === "decision" ? "investigate" : rolled.phaseId,
      };
    }

    case "retract":
      return patchNpc(state, action.npcId, (n) => ({
        ...n,
        error: undefined,
        messages: n.messages.filter((m) => m.id !== action.messageId),
      }));

    case "doc_read":
      return state.readDocIds.includes(action.docId)
        ? state
        : { ...state, readDocIds: [...state.readDocIds, action.docId] };

    // 발송은 되돌릴 수 없다. 여기서 조사 국면이 끝나고 채점이 시작된다.
    case "submit_offer":
      if (!canSubmitOffer(state)) return state;
      return {
        ...state,
        offer: action.offer,
        phaseId: "result",
        grading: true,
        gradeError: undefined,
        report: undefined,
      };

    // 채점 재시도. 오퍼는 이미 나갔으므로 되돌리지 않는다.
    case "grading":
      return state.offer ? { ...state, grading: true, gradeError: undefined } : state;

    case "graded":
      return {
        ...state,
        grading: false,
        gradeError: undefined,
        report: action.report,
        // 채점을 절반만 받았으면(degraded) 아직 결과 국면이다. 다시 채점할 수 있다.
        phaseId: action.report.degraded ? state.phaseId : "debrief",
      };

    case "grade_failed":
      return { ...state, grading: false, gradeError: action.error };
  }
}
