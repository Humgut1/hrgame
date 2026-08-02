/**
 * 온보딩 완료 여부. 세션 상태(state.ts)와 분리해 둔다 — 다시 하기(restart)로
 * 판을 초기화해도 튜토리얼을 또 보여줄 필요는 없으므로 별도 키에 저장한다.
 */

const KEY_PREFIX = "hrgame.tutorial.";

function key(scenarioId: string): string {
  return `${KEY_PREFIX}${scenarioId}`;
}

export function hasSeenTutorial(scenarioId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key(scenarioId)) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(scenarioId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(scenarioId), "1");
  } catch {
    // 용량 초과·프라이빗 모드. 다음 진입에 다시 뜰 뿐 게임은 계속된다.
  }
}
