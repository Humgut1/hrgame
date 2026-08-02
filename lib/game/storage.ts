/**
 * 세션 영속. localStorage 한 곳만 쓴다 — MVP에는 서버 저장소가 없다.
 *
 * 신뢰도를 스테이지 밖으로 누적하는 건(기획서 §2) 스테이지가 여러 개가 된 다음 이야기라
 * 지금은 세션 상태 안에 함께 둔다.
 */

import type { SessionState } from "@/lib/game/state";

const KEY_PREFIX = "hrgame.session.";

function key(scenarioId: string): string {
  return `${KEY_PREFIX}${scenarioId}`;
}

export function loadSession(scenarioId: string): SessionState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key(scenarioId));
    if (!raw) return undefined;
    return JSON.parse(raw) as SessionState;
  } catch {
    // 형식이 깨졌으면 조용히 새로 시작한다. 저장된 판 하나 때문에 게임이 못 열리면 안 된다.
    return undefined;
  }
}

export function saveSession(state: SessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(state.scenarioId), JSON.stringify(state));
  } catch {
    // 용량 초과·프라이빗 모드. 저장만 못 할 뿐 게임은 계속된다.
  }
}

export function clearSession(scenarioId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(scenarioId));
}
