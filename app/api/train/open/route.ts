import { NextResponse } from "next/server";

import { currentSession, needLogin } from "@/lib/auth/guard";
import { learnerPosition } from "@/lib/train/check";
import { callHire, openCompany } from "@/lib/train/company";

/**
 * 연습 화면 열기. body { next, app: 'core'|'hire', seed?: 'applicants'|'finalist' }
 * - next 의 {pos} 는 이 사람의 연습 Hire 공고 id 로 바꾼다.
 * - seed 는 이야기 속 사건(지원자가 들어왔다 / 최종 합격자가 나왔다)을 연습 Hire 에 넣는다.
 *   채점이 아니라 이야기 진행이다 — 같은 사람을 두 번 넣지 않는다.
 */
export async function POST(req: Request) {
  const no = await needLogin();
  if (no) return no;
  const s = await currentSession();
  const learner = s ? { id: s.u, name: s.n } : undefined;
  const body = (await req.json().catch(() => ({}))) as { next?: string; app?: string; seed?: string };
  const app = body.app === "hire" ? "hire" : "core";
  let next = body.next || "";

  if (app === "hire" && (next.includes("{pos}") || body.seed)) {
    const pos = await learnerPosition(learner?.id);
    if (!pos) {
      return NextResponse.json({
        ok: false,
        msg: "아직 Hire 로 넘어간 내 공고가 없습니다. 앞 미션(요청서 → Hire 로 보내기)을 먼저 끝내 주세요.",
      });
    }
    next = next.replace("{pos}", encodeURIComponent(pos));
    if (body.seed === "applicants" || body.seed === "finalist") {
      const r = await callHire("/api/training/applicants", {
        position_id: pos,
        preset: body.seed === "finalist" ? "finalist" : "screen",
      });
      if (!r || !r.ok) return NextResponse.json({ ok: false, msg: "연습 Hire 에 지원자를 넣지 못했습니다. 다시 눌러 주세요." });
    }
  }
  return NextResponse.json(await openCompany(next, learner, app));
}
