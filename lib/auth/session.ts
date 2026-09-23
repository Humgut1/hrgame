/**
 * Grow 로그인 쿠키. Grow 에는 계정 표가 없다 — 누구인지는 TalentCore 가 정하고,
 * 여기서는 "TalentCore 가 확인해 준 사람 id" 만 서명해서 들고 다닌다.
 * 이름·부서·직급·세부 직무는 화면을 열 때마다 TalentCore 에서 새로 읽는다.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "grow_s";
export const STATE_COOKIE = "grow_st";
export const SESSION_DAYS = 7;

export interface GrowSession {
  /** 'core:<테넌트>:<사용자>' */
  u: string;
  /** 표시용 이름 — 진짜 값은 매번 TalentCore 에서 */
  n: string;
  exp: number;
}

const secret = () => process.env.GROW_SESSION_SECRET || "";

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function sessionReady(): boolean {
  return secret().length >= 32;
}

export function issueSession(u: string, n: string): string {
  const s: GrowSession = { u, n, exp: Date.now() + SESSION_DAYS * 864e5 };
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(raw?: string): GrowSession | null {
  if (!raw || !sessionReady()) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GrowSession;
    if (!/^core:\d+:\d+$/.test(s.u) || !(s.exp > Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

/** 로그인 요청 한 번짜리 무작위 값 — 돌아온 표가 이 창에서 시작한 것인지 맞춰 본다. */
export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
