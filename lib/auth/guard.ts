/**
 * 교육 API 문지기. 실제 TalentCore 가 연결돼 있으면 로그인한 사람만 연습 회사를 열고·되돌리고·확인한다.
 * (연결이 없는 로컬 개발에서는 예전처럼 그냥 열린다.)
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { coreReady } from "./core";
import { SESSION_COOKIE, readSession, sessionReady, type GrowSession } from "./session";

export const loginOn = () => coreReady() && sessionReady();

export async function currentSession(): Promise<GrowSession | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** 막아야 하면 응답을, 통과면 null 을 준다. */
export async function needLogin(): Promise<NextResponse | null> {
  if (!loginOn()) return null;
  if (await currentSession()) return null;
  return NextResponse.json(
    { ok: false, state: "offline", msg: "로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인해 주세요." },
    { status: 401 }
  );
}
