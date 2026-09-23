/**
 * 교육 진행 저장. 이 브라우저(localStorage)에 먼저 두고, 로그인한 사람이면 TalentCore 에도 적는다
 * (/api/train/progress). 다른 기기에서 열면 TalentCore 에 적힌 것부터 이어 간다.
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
  /** 마지막으로 바꾼 시각 — 이 브라우저 것과 TalentCore 것 중 새것을 고른다. */
  savedAt?: number;
}

/** 같은 브라우저를 여러 사람이 써도 섞이지 않게 사람 id 를 붙인다. */
const key = (courseId: string, owner?: string) =>
  owner ? `hrgame.train.${owner}.${courseId}` : `hrgame.train.${courseId}`;

export function emptyProgress(courseId: string, firstMission: string): Progress {
  return { courseId, help: "follow", cur: firstMission, missions: {} };
}

export function loadProgress(courseId: string, owner?: string): Progress | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key(courseId, owner));
    return raw ? (JSON.parse(raw) as Progress) : undefined;
  } catch {
    return undefined;
  }
}

export function saveProgress(p: Progress, owner?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(p.courseId, owner), JSON.stringify(p));
  } catch {
    /* 용량 초과·프라이빗 모드. 저장만 못 할 뿐 계속 배울 수는 있다. */
  }
}

export function clearProgress(courseId: string, owner?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(courseId, owner));
}
