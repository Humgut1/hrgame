/**
 * 연습 회사 문 — 교육 모드가 TalentCore 연습 테넌트를 부르는 곳.
 *
 * 연습 회사의 열쇠(API 토큰)는 여기(서버)에만 있다. 브라우저로 내려보내지 않는다.
 * 입장은 2분짜리 일회용 표로만 한다 — 링크가 새어 나가도 다시 쓸 수 없게.
 */

const BASE = (process.env.TRAIN_CORE_URL || "").replace(/\/$/, "");
const TOKEN = process.env.TRAIN_CORE_TOKEN || "";

export type OpenResult =
  | { ok: true; url: string }
  | { ok: false; msg: string };

/** 배우는 사람이 열 수 있는 곳만 — 바깥 주소로 튕겨 보내지 않는다. */
function safeNext(next?: string): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

async function call(path: string): Promise<Response | null> {
  if (!BASE || !TOKEN) return null;
  try {
    return await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "X-API-Token": TOKEN },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** 연습 회사 입장 주소를 만든다(표 한 장). */
export async function openCompany(next?: string): Promise<OpenResult> {
  const r = await call("/api/training/ticket");
  if (!r) return { ok: false, msg: "연습용 TalentCore에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요." };
  if (!r.ok) return { ok: false, msg: "연습 회사 입장표를 받지 못했습니다(권한 확인 필요)." };
  const j = (await r.json()) as { url?: string };
  if (!j.url) return { ok: false, msg: "연습 회사 입장표를 받지 못했습니다." };
  return { ok: true, url: `${j.url}&next=${encodeURIComponent(safeNext(next))}` };
}

/** 연습 회사를 처음 상태로 — 연습 테넌트만 지워진다(실제 회사 데이터는 건드리지 않는다). */
export async function resetCompany(): Promise<{ ok: boolean; msg: string }> {
  const r = await call("/api/training/reset");
  if (!r) return { ok: false, msg: "연습용 TalentCore에 연결하지 못했습니다." };
  if (!r.ok) return { ok: false, msg: "되돌리지 못했습니다. 연습 회사 화면을 닫고 다시 눌러 주세요." };
  return { ok: true, msg: "연습 회사를 처음 상태로 되돌렸습니다." };
}
