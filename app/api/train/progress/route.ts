import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { postProgress } from "@/lib/auth/core";
import { SESSION_COOKIE, readSession } from "@/lib/auth/session";
import { loadCourse } from "@/lib/train/course";

/**
 * 진행 저장 → TalentCore. 누구의 기록인지는 브라우저가 아니라 로그인 쿠키가 정한다.
 * 끝낸 미션 수·전체 미션 수도 과정 파일 기준으로 여기서 센다.
 */
export async function POST(req: Request) {
  const s = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ ok: false, msg: "login" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    courseId?: string;
    profile?: string | null;
    state?: { missions?: Record<string, { done?: boolean }> };
  };
  const id = String(body.courseId || "");
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  let course;
  try {
    course = loadCourse(id);
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const ms = body.state?.missions ?? {};
  const done = course.missions.filter((m) => ms[m.id]?.done).length;

  const r = await postProgress({
    user: s.u,
    course_id: course.id,
    course_title: course.title,
    profile: body.profile ?? null,
    done,
    total: course.missions.length,
    state: body.state ?? {},
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
