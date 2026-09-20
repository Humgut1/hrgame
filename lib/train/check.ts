/**
 * 데이터 확인 — "배우는 사람이 진짜 화면에서 한 일"을 TalentCore 기록으로 본다.
 *
 * 결과는 세 가지다. 정상 / 틀림(무엇이 어긋났는지) / 안 함(아직 못 찾음).
 * 여기서 데이터를 고치지 않는다. 검사기가 쓰기 시작하면 배운 게 아니라
 * 채점이 결과를 만들어 버린다.
 */

import type { Check, CheckResult, Want } from "@/types/training";
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

/** SQLite CURRENT_TIMESTAMP 는 UTC 문자열이다. 미션 시작 시각도 UTC로 맞춰 보낸다. */
function utcStamp(iso: string, graceMin = 10): string {
  const t = new Date(iso).getTime() - graceMin * 60_000;
  return new Date(t).toISOString().slice(0, 19).replace("T", " ");
}

export async function snapshot(since?: string): Promise<{ requisitions: Req[] } | null> {
  const base = (process.env.TRAIN_CORE_URL || "").replace(/\/$/, "");
  const token = process.env.TRAIN_CORE_TOKEN || "";
  if (!base || !token) return null;

  const q = new URLSearchParams({ limit: "40" });
  if (since) q.set("since", utcStamp(since));
  try {
    const r = await fetch(`${base}/api/training/snapshot?${q}`, {
      headers: { "X-API-Token": token },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as { requisitions: Req[] };
  } catch {
    return null;
  }
}

/** 확인할 수 있는 항목. 새 미션이 늘면 여기에만 더한다. */
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
};

function met(w: Want, got: string | number): boolean {
  if (w.min !== undefined) return Number(got) >= w.min;
  if (Array.isArray(w.is)) return w.is.some((v) => String(v) === String(got));
  return String(w.is) === String(got);
}

export async function runCheck(check: Check, since?: string): Promise<CheckResult> {
  const snap = await snapshot(since);
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
      (!dept || (r.dept || "") === dept)
  );
  if (!hits.length) return { state: "todo", msg: check.todo };

  // 여러 건이면 가장 많이 진행된 것을 본다 — 연습 중에 두 번 만들어도 막히지 않게.
  const score = (r: Req) =>
    (r.openings.some((o) => o.external_ref) ? 100 : 0) +
    (["approved", "posted"].includes(r.status) ? 50 : 0) +
    (["pending_dept", "pending_hr"].includes(r.status) ? 20 : 0) +
    r.id / 1000;
  const req = hits.sort((a, b) => score(b) - score(a))[0];

  for (const w of check.want) {
    const get = FIELDS[w.field];
    if (!get) continue;
    const got = get(req);
    if (!met(w, got)) {
      const shown = SHOW[String(got)] ?? String(got);
      return {
        state: "wrong",
        field: LABEL[w.field] || w.field,
        msg: fill(w.msg, shown),
      };
    }
  }
  return { state: "ok", msg: `TalentCore 기록으로 확인했습니다 — ${req.title} (REQ-${req.id})` };
}
