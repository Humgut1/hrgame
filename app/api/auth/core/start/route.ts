import { NextResponse } from "next/server";

import { coreReady, coreUrl } from "@/lib/auth/core";
import { STATE_COOKIE, cookieBase, newState, sessionReady } from "@/lib/auth/session";

/** [TalentCore 계정으로 로그인] — TalentCore 로 보내고, 돌아올 때 맞춰 볼 값을 쿠키에 둔다. */
export async function GET(req: Request) {
  if (!coreReady() || !sessionReady()) {
    return NextResponse.redirect(new URL("/train?login=off", req.url));
  }
  const state = newState();
  const res = NextResponse.redirect(`${coreUrl()}/sso/grow?state=${state}`);
  res.cookies.set(STATE_COOKIE, state, { ...cookieBase, maxAge: 600 });
  return res;
}
