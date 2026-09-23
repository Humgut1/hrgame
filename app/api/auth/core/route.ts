import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyTicket } from "@/lib/auth/core";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  STATE_COOKIE,
  cookieBase,
  issueSession,
} from "@/lib/auth/session";

/**
 * TalentCore 가 돌려보낸 로그인 표(2분)를 받는다.
 * 표는 서버끼리 TalentCore 에 다시 물어 확인하고, 이 창에서 시작한 요청인지(state)도 맞춰 본다.
 */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const jar = await cookies();
  const want = jar.get(STATE_COOKIE)?.value;
  const fail = (why: string) => {
    const res = NextResponse.redirect(new URL(`/train?login=${why}`, req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  if (!t || !want) return fail("again");
  const v = await verifyTicket(t);
  if (!v) return fail("fail");
  if (v.state !== want) return fail("again");

  const res = NextResponse.redirect(new URL("/train", req.url));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, issueSession(v.id, v.name), {
    ...cookieBase,
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
