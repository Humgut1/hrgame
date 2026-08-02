/**
 * 게임 내 시계. 순수 함수만 둔다 — 서버·클라이언트 양쪽에서 쓰고, 3단계 상태머신이 이걸 호출한다.
 *
 * 턴 = 플레이어가 NPC에게 보내는 메시지 1건. 자료 열람은 (기본 설정에서) 시간을 쓰지 않는다.
 */

import type { Clock } from "@/types/scenario";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, totalMinutes);
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface ClockState {
  /** 현재 게임 내 시각 "HH:mm" */
  now: string;
  /** 사용한 턴 수 */
  turnsUsed: number;
  /** 남은 턴 수 */
  turnsLeft: number;
  /** 마감까지 남은 분 */
  minutesLeft: number;
  /** 마감 시각 "HH:mm" */
  deadline: string;
  /** 남은 턴이 2 이하이거나 마감 30분 이내 */
  isTight: boolean;
  /** 턴을 다 썼다 */
  isExhausted: boolean;
}

export function deriveClock(clock: Clock, turnsUsed: number): ClockState {
  const start = toMinutes(clock.startTime);
  const deadline = toMinutes(clock.deadlineTime);
  const used = Math.min(Math.max(0, turnsUsed), clock.maxTurns);

  const nowMinutes = start + used * clock.minutesPerMessage;
  const turnsLeft = clock.maxTurns - used;
  const minutesLeft = Math.max(0, deadline - nowMinutes);

  return {
    now: toHHMM(nowMinutes),
    turnsUsed: used,
    turnsLeft,
    minutesLeft,
    deadline: clock.deadlineTime,
    isTight: turnsLeft <= 2 || minutesLeft <= 30,
    isExhausted: turnsLeft <= 0,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "마감";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** "2026-07-27" → "7월 27일 (월)" */
export function formatGameDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}
