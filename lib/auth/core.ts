/**
 * 실제 회사 TalentCore 로 가는 문 (서버 전용).
 *
 * 연습 회사(lib/train/company.ts, TRAIN_CORE_*)와 다른 문이다.
 *  - 여기(CORE_*)  = 배우는 사람의 진짜 계정·직무·수료 기록
 *  - 연습 회사     = 배우면서 손대는 가짜 회사 데이터
 * 열쇠(CORE_API_TOKEN)는 브라우저로 내려보내지 않는다.
 */

const BASE = (process.env.CORE_URL || "").replace(/\/$/, "");
const TOKEN = process.env.CORE_API_TOKEN || "";

export const coreUrl = () => BASE;
export const coreReady = () => !!(BASE && TOKEN);

export interface JobProfile {
  code: string;
  name: string;
  summary: string;
}

export interface Learner {
  id: string;
  emp_no: string;
  name: string;
  dept: string;
  position: string;
  level: number | null;
  hire_date: string | null;
  job_family: { code: string; name: string } | null;
  job_profile: JobProfile | null;
}

export interface LearningRecord {
  course_id: string;
  course_title: string;
  profile_code: string | null;
  done: number;
  total: number;
  state: Record<string, unknown>;
  updated_at: string;
  completed_at: string | null;
}

async function call(path: string, init?: RequestInit): Promise<Response | null> {
  if (!coreReady()) return null;
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "X-API-Token": TOKEN, "Content-Type": "application/json" },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** TalentCore 가 준 로그인 표를 확인한다. 성공하면 표에 담긴 state 와 사람 id. */
export async function verifyTicket(t: string): Promise<{ state: string; id: string; name: string } | null> {
  const r = await call("/api/sso/verify", { method: "POST", body: JSON.stringify({ t, app: "grow" }) });
  if (!r?.ok) return null;
  const j = (await r.json()) as { ok?: boolean; state?: string; user?: { id: string; name: string } };
  if (!j.ok || !j.user?.id || !j.state) return null;
  return { state: j.state, id: j.user.id, name: j.user.name };
}

export type PersonResult =
  | { ok: true; learner: Learner; records: LearningRecord[] }
  | { ok: false; why: "offline" | "gone" };

/** 사람 정보 + 교육 기록. 부서·직급·세부 직무가 바뀌면 다음 화면부터 바로 따라간다. */
export async function fetchLearner(id: string): Promise<PersonResult> {
  const r = await call(`/api/learning/person?user=${encodeURIComponent(id)}`);
  if (!r) return { ok: false, why: "offline" };
  if (r.status === 403 || r.status === 400) return { ok: false, why: "gone" };
  if (!r.ok) return { ok: false, why: "offline" };
  const j = (await r.json()) as { person: Omit<Learner, "id">; records: LearningRecord[] };
  return { ok: true, learner: { ...j.person, id }, records: j.records ?? [] };
}

/** 진행을 TalentCore 에 적는다. 다 끝내면 TalentCore 가 수료로 남기고 본인에게 알린다. */
export async function postProgress(body: {
  user: string;
  course_id: string;
  course_title: string;
  profile: string | null;
  done: number;
  total: number;
  state: unknown;
}): Promise<{ ok: boolean; completed_now?: boolean; completed_at?: string | null }> {
  const r = await call("/api/learning/progress", { method: "POST", body: JSON.stringify(body) });
  if (!r?.ok) return { ok: false };
  const j = (await r.json()) as { completed_now?: boolean; record?: { completed_at?: string | null } };
  return { ok: true, completed_now: !!j.completed_now, completed_at: j.record?.completed_at ?? null };
}
