/**
 * 교육 과정 로더(서버 전용 — node:fs). 클라이언트에서 import하지 않는다.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Check, Course, Mission } from "@/types/training";

const DIR = path.join(process.cwd(), "data", "training");

export const ACTIVE_COURSE_ID = "hire-basic";

export function loadCourse(courseId: string = ACTIVE_COURSE_ID): Course {
  return JSON.parse(readFileSync(path.join(DIR, `${courseId}.json`), "utf8")) as Course;
}

/** 검사 정의는 서버에만 둔다 — 브라우저로 보내면 정답 조건이 그대로 읽힌다. */
export function findCheck(courseId: string, missionId: string, scene: number): Check | undefined {
  const m: Mission | undefined = loadCourse(courseId).missions.find((x) => x.id === missionId);
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
