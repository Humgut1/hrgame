/**
 * 교육 진행 저장. localStorage 한 곳만 쓴다 — 프로토타입에는 서버 저장소가 없다.
 * (실제 배포 때는 연습 계정별로 서버에 남겨야 이어서 배울 수 있다.)
 */

import type { HelpLevel } from "@/types/training";

export interface MissionProgress {
  at: number;
  done?: boolean;
  /** 미션을 시작한 시각 — 이 시각 이후에 만든 기록만 확인 대상으로 본다. */
  startedAt?: string;
  /** 판단 체크에서 고른 답 — 새로고침해도 이야기가 그대로 보이게 */
  picks?: Record<string, number>;
  /** 판단 체크에서 틀린 횟수 */
  wrongs?: number;
}

export interface Progress {
  courseId: string;
  help: HelpLevel;
  cur: string;
  missions: Record<string, MissionProgress>;
}

const key = (courseId: string) => `hrgame.train.${courseId}`;

export function emptyProgress(courseId: string, firstMission: string): Progress {
  return { courseId, help: "follow", cur: firstMission, missions: {} };
}

export function loadProgress(courseId: string): Progress | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key(courseId));
    return raw ? (JSON.parse(raw) as Progress) : undefined;
  } catch {
    return undefined;
  }
}

export function saveProgress(p: Progress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(p.courseId), JSON.stringify(p));
  } catch {
    /* 용량 초과·프라이빗 모드. 저장만 못 할 뿐 계속 배울 수는 있다. */
  }
}

export function clearProgress(courseId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(courseId));
}
