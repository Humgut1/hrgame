/**
 * /api/npc · /api/grade 의 요청·응답 계약. 타입만 둔다 — 클라이언트와 라우트 핸들러가 같이 import한다.
 *
 * 서버는 상태를 들고 있지 않다(MVP에 DB가 없다). 클라이언트가 매 요청마다 신뢰도·공개된
 * 정보·대화 로그를 함께 보내고, 서버는 그걸 근거로 이번 답장의 공개 범위를 다시 계산한다.
 * 그래서 숨은 정보의 본문은 브라우저로 한 번도 나가지 않는다.
 */

import type { AarSection } from "@/types/scenario";
import type { OfferValues } from "@/lib/game/offer";

export interface NpcTurnRequest {
  scenarioId: string;
  npcId: string;
  /** 현재 신뢰도 0~100 */
  trust: number;
  turnsUsed: number;
  /** 이미 공개된 secret id */
  revealedSecretIds: string[];
  /** 첫 인사말을 포함한 지금까지의 대화 */
  history: { from: "npc" | "player"; text: string }[];
  /** 플레이어가 방금 보낸 메시지 */
  message: string;
}

export interface NpcTurnResponse {
  reply: string;
  /** 반영 후 신뢰도 */
  trust: number;
  trustDelta: number;
  /** 이번 답장에서 실제로 공개된 secret id */
  revealedSecretIds: string[];
}

export interface ApiErrorBody {
  error: string;
}

// ---------------------------------------------------------------------------
// /api/grade
// ---------------------------------------------------------------------------

/**
 * 채점 요청. 판을 통째로 보낸다 — 무엇을 읽었고 누구와 어떤 말을 했는지가 곧 채점 근거다.
 * 서버는 이걸로 페널티를 스스로 판정하고, 채점 LLM에게는 판정 결과를 사실로 넘긴다.
 */
export interface GradeRequest {
  scenarioId: string;
  offer: OfferValues;
  turnsUsed: number;
  /** 자료실에서 실제로 연 문서 id */
  readDocIds: string[];
  npcs: {
    npcId: string;
    /** 종료 시점 신뢰도 */
    trust: number;
    /** 인사말 포함 전체 로그. 전송 실패 건은 빼고 보낸다. */
    messages: { from: "npc" | "player"; text: string }[];
  }[];
}

export interface AxisScore {
  axisId: string;
  name: string;
  /** 0~100. 페널티 상한까지 적용된 최종 점수 */
  score: number;
  comment: string;
  /** 페널티로 상한이 걸렸으면 그 값 */
  cappedAt?: number;
}

export interface ReportSection {
  id: string;
  title: string;
  kind: AarSection["kind"];
  body?: string;
  bullets?: string[];
}

export interface TriggeredPenalty {
  id: string;
  when: string;
  effect: string;
  /** 코드가 판정했는가, 채점 LLM이 판정했는가 */
  judgedBy: "code" | "model";
}

export interface GradeReport {
  scenarioId: string;
  /** aar.outcomeOptions 중 하나 */
  outcome: string;
  /** 축 가중 평균 */
  totalScore: number;
  bandLabel?: string;
  bandMeaning?: string;
  axes: AxisScore[];
  sections: ReportSection[];
  penalties: TriggeredPenalty[];
  /** 채점 응답을 읽지 못해 코드가 판정한 부분만 담았다. 다시 채점할 수 있다. */
  degraded?: boolean;
}
