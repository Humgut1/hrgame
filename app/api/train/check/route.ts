/**
 * 데이터 확인 문. 검사 조건과 TalentCore 열쇠는 서버에만 있다.
 */

import { NextResponse } from "next/server";

import { runCheck } from "@/lib/train/check";
import { ACTIVE_COURSE_ID, findCheck } from "@/lib/train/course";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    courseId?: string;
    missionId?: string;
    scene?: number;
    since?: string;
  };

  const check = findCheck(
    body.courseId || ACTIVE_COURSE_ID,
    body.missionId || "",
    Number(body.scene ?? -1)
  );
  if (!check) {
    return NextResponse.json({ state: "offline", msg: "확인할 항목을 찾지 못했습니다." });
  }

  return NextResponse.json(await runCheck(check, body.since));
}
