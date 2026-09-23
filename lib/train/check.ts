/**
 * 데이터 확인 — "배우는 사람이 진짜 화면에서 한 일"을 TalentCore·Hire 기록으로 본다.
 *
 * 결과는 세 가지다. 정상 / 틀림(무엇이 어긋났는지) / 안 함(아직 못 찾음).
 * 여기서 데이터를 고치지 않는다. 검사기가 쓰기 시작하면 배운 게 아니라
 * 채점이 결과를 만들어 버린다.
 *
 * 개인 연습 자리: 배우는 사람(core:T:U)이 있으면 그 사람이 올린 요청서만 본다.
 * Hire 쪽은 그 요청서에서 넘어간 공고(external_ref)만 본다 — 옆 사람 연습이 섞이지 않게.
 */

import type { Check, CheckResult, Want } from "@/types/training";
import { callHire } from "./company";
import { fill } from "./josa";

interface Req {
  id: number;
  title: string;
  status: string;
  hire_type: string;
  headcount: number;
  dept: string | null;
  backfill_name: string | null;
  salary_min: number;
  salary_max: number;
  created_at: string;
  lines: { headcount: number }[];
  approvals: { step_no: number; status: string }[];
  openings: { id: number; code: string | null; status: string; external_ref: string | null }[];
}

interface Hired {
  id: number;
  name: string;
  status: string;
  opening_id: number | null;
}

interface Snap {
  requisitions: Req[];
  incoming_hires: Hired[];
}

interface HStage { id: string; nm: string; kind: string; ord: number; ivs?: string[] | null }
interface HCand { id: string; nm: string; st: string; s: string }
interface HPos {
  id: string;
  title: string;
  hm: string | null;
  jd: string | null;
  stages: HStage[];
  candidates: HCand[];
  interviews: { candidate_id: string; st: string; sched_date: string | null }[];
  meetings: { nm: string; v: string }[];
}
interface HSnap {
  positions: HPos[];
  offers: { candidate_id: string; st: string; base: number | null }[];
  evaluations: { candidate_id: string; st: string }[];
}

/** SQLite CURRENT_TIMESTAMP 는 UTC 문자열이다. 미션 시작 시각도 UTC로 맞춰 보낸다. */
function utcStamp(iso: string, graceMin = 10): string {
  const t = new Date(iso).getTime() - graceMin * 60_000;
  return new Date(t).toISOString().slice(0, 19).replace("T", " ");
}

export async function snapshot(since?: string, learner?: string): Promise<Snap | null> {
  const base = (process.env.TRAIN_CORE_URL || "").replace(/\/$/, "");
  const token = process.env.TRAIN_CORE_TOKEN || "";
  if (!base || !token) return null;

  const q = new URLSearchParams({ limit: "40" });
  if (since) q.set("since", utcStamp(since));
  if (learner) q.set("learner", learner);
  try {
    const r = await fetch(`${base}/api/training/snapshot?${q}`, {
      headers: { "X-API-Token": token },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<Snap>;
    return { requisitions: j.requisitions || [], incoming_hires: j.incoming_hires || [] };
  } catch {
    return null;
  }
}

async function hireSnapshot(positions: string[]): Promise<HSnap | null> {
  const r = await callHire("/api/training/snapshot", { positions });
  if (!r || !r.ok) return null;
  const j = (await r.json()) as Partial<HSnap> & { ok?: boolean };
  if (!j.ok) return null;
  return { positions: j.positions || [], offers: j.offers || [], evaluations: j.evaluations || [] };
}

/** 확인할 수 있는 항목(TalentCore 요청서). 새 미션이 늘면 여기에만 더한다. */
const FIELDS: Record<string, (r: Req) => string | number> = {
  status: (r) => r.status,
  hire_type: (r) => r.hire_type,
  dept: (r) => r.dept || "",
  headcount: (r) =>
    r.lines.length ? r.lines.reduce((a, l) => a + (l.headcount || 0), 0) : r.headcount,
  backfill: (r) => (r.backfill_name ? "set" : "none"),
  band: (r) => (r.salary_min > 0 && r.salary_max > 0 ? "set" : "none"),
  openings: (r) => r.openings.length,
  openings_open: (r) => r.openings.filter((o) => o.status === "open").length,
  hire_linked: (r) => (r.openings.some((o) => o.external_ref) ? "yes" : "no"),
};

/** Hire 공고 쪽 항목. 값 뒤 ':' 로 후보자 이름을 받는 것도 있다(cand:문지호). */
interface HCtx { pos: HPos; hs: HSnap; req: Req; core: Snap }
const kindOf = (p: HPos, c?: HCand) => (c ? p.stages.find((s) => s.id === c.st)?.kind || "none" : "none");
const byName = (p: HPos, nm: string) => p.candidates.find((c) => c.nm === nm);
const OFFER_RANK = ["none", "draft", "approval", "sent", "declined", "accepted"];

const HFIELDS: Record<string, (x: HCtx, arg: string) => string | number> = {
  jd: (x) => ((x.pos.jd || "").replace(/※.*\n?/, "").trim().length >= 80 ? "set" : "none"),
  hm: (x) => (x.pos.hm && x.pos.hm !== "—" ? "set" : "none"),
  stages: (x) => x.pos.stages.length,
  interview_stages: (x) => x.pos.stages.filter((s) => s.kind === "interview").length,
  /** 면접관이 한 명도 없는 면접 단계 수 — 0 이어야 후보자를 그 단계로 보낼 수 있다 */
  iv_empty: (x) => x.pos.stages.filter((s) => s.kind === "interview" && !(s.ivs || []).length).length,
  candidates: (x) => x.pos.candidates.length,
  /** 후보자가 지금 어떤 종류의 단계에 있나(apply·screen·interview·task·offer·hired·reject) */
  cand: (x, nm) => kindOf(x.pos, byName(x.pos, nm)),
  /** 그 후보자 면접이 잡혔나 — 후보자에게 시간을 보냈으면(proposed) 잡힌 것으로 본다 */
  iv: (x, nm) => {
    const c = byName(x.pos, nm);
    const ivs = c ? x.pos.interviews.filter((i) => i.candidate_id === c.id) : [];
    if (ivs.some((i) => ["confirmed", "done"].includes(i.st))) return "confirmed";
    if (ivs.some((i) => i.st === "proposed")) return "proposed";
    if (ivs.some((i) => ["draft", "searching"].includes(i.st))) return "draft";
    return "none";
  },
  /** 그 후보자 오퍼가 어디까지 갔나 */
  offer: (x, nm) => {
    const c = byName(x.pos, nm);
    const os = c ? x.hs.offers.filter((o) => o.candidate_id === c.id) : [];
    return os.map((o) => o.st).sort((a, b) => OFFER_RANK.indexOf(b) - OFFER_RANK.indexOf(a))[0] || "none";
  },
  /** TalentCore 입사 예정자로 넘어갔나 */
  core_hire: (x) => {
    const ids = new Set(x.req.openings.map((o) => o.id));
    return x.core.incoming_hires.some((h) => h.opening_id !== null && ids.has(h.opening_id)) ? "yes" : "no";
  },
};

const LABEL: Record<string, string> = {
  status: "요청서 상태",
  hire_type: "채용 유형",
  dept: "부서",
  headcount: "인원",
  backfill: "누구 자리인가",
  band: "연봉 범위",
  openings: "포지션",
  openings_open: "공고 중인 포지션",
  hire_linked: "Hire 연결",
  jd: "공고 내용",
  hm: "하이어링 매니저",
  stages: "전형 단계",
  interview_stages: "면접 단계",
  iv_empty: "면접관 없는 면접 단계",
  candidates: "지원자",
  cand: "후보자 단계",
  iv: "면접 일정",
  offer: "오퍼",
  core_hire: "입사 예정자 등록",
};

/** 한글로 보여 줄 수 있는 값은 바꿔 준다. 코드값을 그대로 보이면 배우는 사람이 못 읽는다. */
const SHOW: Record<string, string> = {
  draft: "작성 중",
  pending_dept: "결재 진행 중",
  pending_hr: "인사 결재 중",
  approved: "승인됨",
  rejected: "반려",
  posted: "Hire로 넘김",
  backfill: "결원 충원",
  new_planned: "계획 증원",
  new_unplanned: "계획 외 증원",
  set: "있음",
  none: "없음",
  yes: "됨",
  no: "안 됨",
  apply: "지원 접수",
  screen: "서류 검토",
  interview: "면접",
  task: "과제",
  offer: "오퍼",
  hired: "입사 확정",
  reject: "불합격",
  searching: "시간 찾는 중",
  proposed: "후보자에게 시간 보냄",
  confirmed: "확정",
  approval: "결재 중",
  sent: "보냄",
  accepted: "수락",
  declined: "거절",
};

function met(w: Want, got: string | number): boolean {
  if (w.min !== undefined) return Number(got) >= w.min;
  if (Array.isArray(w.is)) return w.is.some((v) => String(v) === String(got));
  return String(w.is) === String(got);
}

function wrong(w: Want, label: string, got: string | number): CheckResult {
  const shown = SHOW[String(got)] ?? String(got);
  return { state: "wrong", field: label, msg: fill(w.msg, shown) };
}

export async function runCheck(check: Check, since?: string, learner?: string): Promise<CheckResult> {
  // Hire 쪽을 볼 때는 요청서가 앞 미션에서 만들어졌으므로 시각으로 좁히지 않는다.
  const snap = await snapshot(check.kind === "hire" ? undefined : since, learner);
  if (!snap) {
    return {
      state: "offline",
      msg: "연습용 TalentCore에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.",
    };
  }

  const has = (check.find.titleHas || "").trim();
  const dept = (check.find.deptIs || "").trim();
  const hits = snap.requisitions.filter(
    (r) =>
      (!has || (r.title || "").includes(has)) &&
      (!dept || (r.dept || "") === dept) &&
      (check.kind !== "hire" || r.openings.some((o) => o.external_ref))
  );
  if (!hits.length) return { state: "todo", msg: check.todo };

  // 여러 건이면 가장 많이 진행된 것을 본다 — 연습 중에 두 번 만들어도 막히지 않게.
  const score = (r: Req) =>
    (r.openings.some((o) => o.external_ref) ? 100 : 0) +
    (["approved", "posted"].includes(r.status) ? 50 : 0) +
    (["pending_dept", "pending_hr"].includes(r.status) ? 20 : 0) +
    r.id / 1000;
  const req = hits.sort((a, b) => score(b) - score(a))[0];

  if (check.kind !== "hire") {
    for (const w of check.want) {
      const get = FIELDS[w.field];
      if (!get) continue;
      const got = get(req);
      if (!met(w, got)) return wrong(w, LABEL[w.field] || w.field, got);
    }
    return { state: "ok", msg: `TalentCore 기록으로 확인했습니다 — ${req.title} (REQ-${req.id})` };
  }

  const refs = req.openings.map((o) => o.external_ref).filter((x): x is string => !!x);
  const hs = await hireSnapshot(refs);
  if (!hs) {
    return { state: "offline", msg: "연습용 Hire에 연결하지 못했습니다. 잠시 뒤 다시 확인해 주세요." };
  }
  // 포지션이 여러 개면 지원자가 가장 많은 공고(= 실제로 일하고 있는 공고)
  const pos = hs.positions.sort((a, b) => b.candidates.length - a.candidates.length)[0];
  if (!pos) return { state: "todo", msg: check.todo };

  const x: HCtx = { pos, hs, req, core: snap };
  for (const w of check.want) {
    const [key, arg = ""] = w.field.split(":");
    const get = HFIELDS[key];
    if (!get) continue;
    const got = get(x, arg);
    if (!met(w, got)) return wrong(w, (LABEL[key] || key) + (arg ? ` — ${arg}` : ""), got);
  }
  return { state: "ok", msg: `Hire 기록으로 확인했습니다 — ${pos.title} (${pos.id})` };
}

/** 배우는 사람이 지금 일하고 있는 Hire 공고 id — 가장 많이 진행된 요청서에서 넘어간 것. */
export async function learnerPosition(learner?: string): Promise<string | null> {
  const snap = await snapshot(undefined, learner);
  if (!snap) return null;
  const linked = snap.requisitions
    .filter((r) => r.openings.some((o) => o.external_ref))
    .sort((a, b) => b.id - a.id);
  return linked[0]?.openings.find((o) => o.external_ref)?.external_ref ?? null;
}
