/** 앞말 받침에 맞춰 조사를 고른다.
 *
 * 검사 결과 문장은 값(예: '계획 증원')을 끼워 넣고 그 뒤에 조사가 붙는다.
 * 값이 무엇이냐에 따라 '로/으로', '은/는'이 달라지므로 끼워 넣은 뒤에 고친다.
 * 한국어가 어색하면 배우는 사람은 화면을 덜 믿는다.
 */

const HANGUL_FIRST = 44032; // 가
const HANGUL_LAST = 55203; // 힣

/** 끝소리 받침: 0 없음 / 8 ㄹ / 그 외 있음. 모르면 null */
function jong(word: string): number | null {
  const ch = word.trim().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) return (code - HANGUL_FIRST) % 28;
  const digit: Record<string, number> = {
    "0": 8, "1": 8, "2": 0, "3": 8, "4": 0,
    "5": 0, "6": 8, "7": 8, "8": 8, "9": 0,
  };
  if (ch in digit) return digit[ch];
  return null; // 영문·기호 — 건드리지 않는다
}

/** [받침 있음, 받침 없음] */
const PAIR: Record<string, [string, string]> = {
  은: ["은", "는"], 는: ["은", "는"],
  이: ["이", "가"], 가: ["이", "가"],
  을: ["을", "를"], 를: ["을", "를"],
  과: ["과", "와"], 와: ["과", "와"],
  으로: ["으로", "로"], 로: ["으로", "로"],
  이라: ["이라", "라"], 라: ["이라", "라"],
  이어야: ["이어야", "여야"], 여야: ["이어야", "여야"],
  이었: ["이었", "였"], 였: ["이었", "였"],
};

// 긴 것부터 찾아야 '으로'가 '로'로 잘리지 않는다
const TOKENS = Object.keys(PAIR).sort((a, b) => b.length - a.length);

/** 한 낱말 뒤에 붙일 조사를 고른다 */
export function josa(word: string, j: string): string {
  const pair = PAIR[j];
  if (!pair) return j;
  const t = jong(word);
  if (t === null) return pair[1];
  if (t === 8 && (j === "로" || j === "으로")) return "로"; // 서울로
  return t === 0 ? pair[1] : pair[0];
}

/** 문장에 값을 끼워 넣고, 바로 뒤에 붙은 조사를 값에 맞춘다 */
export function fill(tpl: string, value: string): string {
  const at = tpl.indexOf("{got}");
  if (at < 0) return tpl;
  const head = tpl.slice(0, at) + value;
  let rest = tpl.slice(at + 5);

  // 값이 따옴표·괄호 안이면 그 닫는 짝은 건너뛴다 — '{got}'로
  let skip = 0;
  while (skip < rest.length && "'’\")]".includes(rest[skip])) skip += 1;
  const closed = rest.slice(0, skip);
  rest = rest.slice(skip);

  for (const t of TOKENS) {
    if (rest.startsWith(t)) {
      const after = rest[t.length] || "";
      // 조사 뒤가 글자면 낱말의 일부다 — '로마'를 조사로 보면 안 된다
      if (after && !" .,·)…!?\n".includes(after)) continue;
      return head + closed + josa(value, t) + rest.slice(t.length);
    }
  }
  return head + closed + rest;
}
