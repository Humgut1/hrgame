/**
 * 교육 과정 로더(서버 전용 — node:fs). 클라이언트에서 import하지 않는다.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Check, Course, Mission } from "@/types/training";

const DIR = path.join(process.cwd(), "data", "training");

export const ACTIVE_COURSE_ID = "hire-basic";

export function loadCourse(courseId: string = ACTIVE_COURSE_ID): Course {
  if (!/^[a-z0-9-]{1,60}$/.test(courseId)) throw new Error("bad course id");
  return JSON.parse(readFileSync(path.join(DIR, `${courseId}.json`), "utf8")) as Course;
}

/** 검사 정의는 서버에만 둔다 — 브라우저로 보내면 정답 조건이 그대로 읽힌다. */
export function findCheck(courseId: string, missionId: string, scene: number): Check | undefined {
  let c: Course;
  try {
    c = loadCourse(courseId);
  } catch {
    return undefined;
  }
  const m: Mission | undefined = c.missions.find((x) => x.id === missionId);
  const s = m?.scenes?.[scene];
  return s && s.k === "do" ? s.check : undefined;
}

/** 클라이언트로 내보낼 때 검사 조건을 떼어 낸다. */
export function toClientCourse(course: Course): Course {
  return {
    ...course,
    missions: course.missions.map((m) => ({
      ...m,
      scenes: m.scenes?.map((s) =>
        s.k === "do" ? { ...s, check: { kind: s.check.kind, find: {}, want: [], todo: "" } } : s
      ),
    })),
  };
}

/** 과정 전부 — data/training/*.json */
export function listCourses(): Course[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadCourse(f.slice(0, -5)));
}

/**
 * 세부 직무에 맞는 과정. 딱 맞는 과정(profiles 에 그 직무가 있는 것) 중 받는 직무가 가장 적은 것,
 * 없으면 null — 아무 과정이나 주지 않는다(맞지 않는 교육을 수료로 남기면 기록이 거짓이 된다).
 */
export function courseFor(profileCode?: string | null): Course | null {
  if (!profileCode) return null;
  const hit = listCourses()
    .filter((c) => c.profiles?.includes(profileCode))
    .sort((a, b) => (a.profiles?.length ?? 0) - (b.profiles?.length ?? 0));
  return hit[0] ?? null;
}
