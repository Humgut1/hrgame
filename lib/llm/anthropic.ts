/**
 * Anthropic 호출을 감싸는 서버 전용 모듈.
 * 클라이언트 컴포넌트에서 import하지 말 것 — API 키가 여기 있다. (CLAUDE.md 절대 규칙)
 */

import Anthropic from "@anthropic-ai/sdk";

/** NPC 대사 생성용 모델. 게임 안의 LLM이므로 여기 한 줄만 바꾸면 전부 바뀐다. */
export const NPC_MODEL = "claude-opus-5";

/** 채점용 모델. 판 하나에 한 번만 부르고 결과가 오래 남으므로 속도보다 판단력을 택한다. */
export const GRADE_MODEL = "claude-opus-5";

let client: Anthropic | undefined;

/** ANTHROPIC_API_KEY는 환경변수에서만 읽는다. 코드에 박지 않는다. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  client ??= new Anthropic();
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.");
    this.name = "MissingApiKeyError";
  }
}

// ---------------------------------------------------------------------------
// 응답 파싱
// ---------------------------------------------------------------------------

/** 응답에서 text 블록만 이어 붙인다. content는 thinking 블록도 섞인 유니온이다. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * JSON 파싱 fallback. (CLAUDE.md 절대 규칙)
 * 구조화 출력을 걸어 두더라도 코드펜스나 앞뒤 군말이 붙는 경우를 대비한다.
 *   1) 그대로 파싱
 *   2) 코드펜스 제거 후 파싱
 *   3) 첫 '{' 부터 마지막 '}' 까지 잘라 파싱
 */
export function parseJsonLoose<T>(raw: string): T | undefined {
  const attempts = [
    raw,
    raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""),
    sliceBraces(raw),
  ];

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // 다음 후보로
    }
  }
  return undefined;
}

function sliceBraces(raw: string): string | undefined {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  return raw.slice(start, end + 1);
}

/** 사용자에게 보여도 되는 한 줄로 바꾼다. 내부 오류 원문을 그대로 노출하지 않는다. */
export function describeApiError(error: unknown): string {
  if (error instanceof MissingApiKeyError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) {
    return "API 키가 유효하지 않습니다.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "요청이 몰렸습니다. 잠시 후 다시 보내 주세요.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "요청이 거부되었습니다. 메시지를 줄여서 다시 보내 주세요.";
  }
  if (error instanceof Anthropic.APIError) {
    return "대화 서버에 연결하지 못했습니다. 다시 보내 주세요.";
  }
  return "답장을 받지 못했습니다. 다시 보내 주세요.";
}
