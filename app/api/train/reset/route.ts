import { NextResponse } from "next/server";

import { currentSession, needLogin } from "@/lib/auth/guard";
import { resetCompany } from "@/lib/train/company";

/** 처음으로 — 로그인한 사람이면 그 사람의 연습 기록만(다른 사람 연습은 그대로). */
export async function POST() {
  const no = await needLogin();
  if (no) return no;
  const s = await currentSession();
  return NextResponse.json(await resetCompany(s ? { id: s.u, name: s.n } : undefined));
}
