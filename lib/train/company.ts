/**
 * 연습 회사 문 — 교육 모드가 TalentCore 연습 테넌트(와 연습 Hire)를 부르는 곳.
 *
 * 연습 회사의 열쇠(API 토큰)는 여기(서버)에만 있다. 브라우저로 내려보내지 않는다.
 * 입장은 2분짜리 일회용 표로만 한다 — 링크가 새어 나가도 다시 쓸 수 없게.
 *
 * 개인 연습 자리: 배우는 사람(core:T:U)마다 연습 회사 인사팀에 자기 계정이 생긴다.
 * 내가 올린 요청서만 채점되고, [처음으로]는 내 것만 지운다.
 */

const BASE = (process.env.TRAIN_CORE_URL || "").replace(/\/$/, "");
const TOKEN = process.env.TRAIN_CORE_TOKEN || "";
const HIRE = (process.env.TRAIN_HIRE_URL || "").replace(/\/$/, "");
const HIRE_TOKEN = process.env.TRAIN_HIRE_TOKEN || "";

export const hireReady = () => !!(HIRE && HIRE_TOKEN);

export interface Learner {
  id: string;
  name: string;
}

export type OpenResult =
  | { ok: true; url: string }
  | { ok: false; msg: string };

/** 배우는 사람이 열 수 있는 곳만 — 바깥 주소로 튕겨 보내지 않는다. */
function safeNext(next?: string): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

async function call(path: string, body?: object): Promise<Response | null> {
  if (!BASE || !TOKEN) return null;
  try {
    return await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "X-API-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** 연습 Hire 문 — 토큰은 x-train-token. */
export async function callHire(path: string, body: object): Promise<Response | null> {
  if (!hireReady()) return null;
  try {
    return await fetch(`${HIRE}${path}`, {
      method: "POST",
      headers: { "x-train-token": HIRE_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

const who = (l?: Learner) => (l ? { learner: l.id, name: l.name } : {});

/** 표 주소는 Grow 가 아는 연습 회사 주소(https)로 다시 붙인다 — TalentCore 가 프록시 뒤에서 http 로 적어 줄 때가 있다. */
function onBase(u: string): string {
  try {
    const p = new URL(u);
    return `${BASE}${p.pathname}${p.search}`;
  } catch {
    return u;
  }
}

/** 연습 회사 입장 주소를 만든다(표 한 장). 연습 Hire 는 그 연습 계정으로 로그인해서 들어간다. */
export async function openCompany(next?: string, learner?: Learner, app: "core" | "hire" = "core"): Promise<OpenResult> {
  if (app === "hire") {
    if (!HIRE) return { ok: false, msg: "연습용 Hire 주소가 설정돼 있지 않습니다." };
    // Hire 로그인은 TalentCore 연습 회사 계정으로 — 먼저 연습 회사에 들어가 있어야 한다.
    const r = await call("/api/training/ticket", who(learner));
    if (!r || !r.ok) return { ok: false, msg: "연습 회사 입장표를 받지 못했습니다." };
    const j = (await r.json()) as { url?: string };
    const hireStart = `${HIRE}/api/auth/core/start?next=${encodeURIComponent(safeNext(next || "/"))}`;
    // 연습 회사에 로그인한 뒤 곧장 Hire 로그인 입구로 — Core 는 자기에게 연결된 Hire 주소만 허용한다.
    return { ok: true, url: `${onBase(j.url || "")}&next=${encodeURIComponent(hireStart)}` };
  }
  const r = await call("/api/training/ticket", who(learner));
  if (!r) return { ok: false, msg: "연습용 TalentCore에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요." };
  if (!r.ok) return { ok: false, msg: "연습 회사 입장표를 받지 못했습니다(권한 확인 필요)." };
  const j = (await r.json()) as { url?: string };
  if (!j.url) return { ok: false, msg: "연습 회사 입장표를 받지 못했습니다." };
  return { ok: true, url: `${onBase(j.url)}&next=${encodeURIComponent(safeNext(next))}` };
}

/** 처음 상태로 — 배우는 사람이 있으면 그 사람이 한 일만(TalentCore + 연습 Hire). */
export async function resetCompany(learner?: Learner): Promise<{ ok: boolean; msg: string }> {
  const r = await call("/api/training/reset", who(learner));
  if (!r) return { ok: false, msg: "연습용 TalentCore에 연결하지 못했습니다." };
  if (!r.ok) return { ok: false, msg: "되돌리지 못했습니다. 연습 회사 화면을 닫고 다시 눌러 주세요." };
  if (!learner) return { ok: true, msg: "연습 회사를 처음 상태로 되돌렸습니다." };
  const j = (await r.json()) as { requisitions?: number; hire_refs?: string[] };
  const refs = j.hire_refs || [];
  if (refs.length) {
    const h = await callHire("/api/training/reset", { positions: refs });
    if (!h || !h.ok) return { ok: false, msg: "TalentCore 쪽은 지웠지만 연습 Hire 공고를 지우지 못했습니다. 다시 눌러 주세요." };
  }
  return { ok: true, msg: `내 연습 기록을 지웠습니다 — 요청서 ${j.requisitions ?? 0}건${refs.length ? ` · Hire 공고 ${refs.length}건` : ""}.` };
}
