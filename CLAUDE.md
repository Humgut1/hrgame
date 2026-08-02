# HR 실무 시뮬레이터

기획·설계의 단일 출처: **[docs/기획서.md](docs/기획서.md)** — 작업 시작 시 반드시 먼저 읽는다.

## 절대 규칙

- **한 번에 하나씩.** 작업 순서(기획서 §11)의 한 단계를 끝내면 확인받고 다음으로 간다.
- **API 키는 클라이언트에 절대 노출하지 않는다.** Anthropic SDK 호출은 Next.js Route Handler(`/api/npc`, `/api/grade`)에서만.
- **진행은 상태머신이 소유하고 LLM은 대사만 생성한다.** 국면 전환을 LLM이 결정하게 두지 않는다.
- **시나리오/회사/NPC/문서 데이터는 코드에 박지 않는다.** `data/` 아래 JSON으로만 존재한다.
- LLM JSON 응답은 파싱 실패 fallback 필수(코드펜스 제거 → 첫 `{`부터 마지막 `}`까지 슬라이스).
- ORM 없이 직접 쿼리. UI 라이브러리 없이 Tailwind만.

## 데이터 레이아웃

```
data/
  schema/company.schema.json     회사 마스터 데이터 스키마
  schema/scenario.schema.json    시나리오 스키마
  companies/lift.json            ㈜리프트 — 전 시나리오 공용 마스터 데이터
  scenarios/recruit-03-offer-negotiation.json
types/scenario.ts                위 두 스키마의 TypeScript 미러
scripts/validate-data.mjs        무의존 구조/참조 무결성 검증기
```

시나리오 문서(자료실)는 `blocks` 배열로 렌더한다. `companyTable` 블록은 회사 마스터 데이터를
경로(`compensation.bands` 등)로 참조하므로 급여·밴드·재직자 정보의 진실은 항상 회사 JSON 한 곳에만 있다.

## 라우팅

```
/                              스테이지 선택
/workspace                     상황 브리핑 (셸의 첫 화면)
/workspace/messages            → 첫 NPC 대화로 리다이렉트
/workspace/messages/[npcId]    대화 스레드
/workspace/docs                자료실 목록
/workspace/docs/[docId]        문서 상세
/workspace/offer               오퍼 작성
```

`app/workspace/layout.tsx` 가 셸(헤더 + 좌측 네비)을 소유하고 시나리오를 로드한다.
`lib/data.ts` 는 서버 전용(`node:fs`)이므로 클라이언트 컴포넌트에서 import하지 않는다.
`lib/clock.ts` 는 순수 함수만 두어 서버·클라이언트·상태머신이 같은 계산을 쓴다.

## 대화 엔진

```
lib/game/state.ts          세션 타입 + 순수 리듀서(턴·시각·국면·실패 롤백)
lib/game/secrets.ts        숨은 정보 공개 판정(minTrust + 키워드), trustDelta 범위
lib/game/storage.ts        localStorage 저장/복원
lib/game/api.ts            /api/npc 요청·응답 계약 타입(클라·서버 공용)
lib/game/SessionProvider.tsx  세션 컨텍스트 + 전송 오케스트레이션
lib/llm/anthropic.ts       SDK 클라이언트, textOf, parseJsonLoose, 에러 문구
lib/llm/npc-prompt.ts      NPC 시스템 프롬프트 조립 + 응답 JSON 스키마
app/api/npc/route.ts       라우트 핸들러
```

지켜야 하는 경계:

- **공개 판정은 서버 코드가 한다.** `gateSecrets`가 통과시킨 secret만 프롬프트에 실린다.
  허용되지 않은 secret은 프롬프트에 아예 존재하지 않으므로 LLM이 흘릴 수가 없다.
  응답의 `trustDelta`는 `trustRules` 범위로, `revealedSecretIds`는 허용 집합으로 서버가 다시 조인다.
- **NPC별 데이터 격리는 `dataAccess`가 한다.** 시나리오 JSON의 NPC마다 회사 데이터 점 경로를 적고,
  그 경로만 프롬프트에 실린다. 그래서 플레이어는 두 사람 모두와 이야기해야 한다.
- **클라이언트로 넘기는 시나리오는 반드시 `toClientScenario()`를 통과시킨다.**
  전체 `Scenario`를 클라이언트 컴포넌트 prop으로 넘기면 secrets가 RSC 페이로드에 실려 브라우저에서 읽힌다.
- **턴 회계는 양쪽이 센다.** 클라이언트 리듀서는 UX용, 라우트 핸들러는 `turnsUsed >= maxTurns`를 409로 다시 막는다.
- **전송 실패는 턴을 소모하지 않는다.** `send_failed`가 턴과 국면 전환을 되돌린다.

## 채점 엔진

```
lib/game/offer.ts          오퍼 검증 + 페널티 판정 + 총점(순수 함수, 클라·서버 공용)
lib/llm/grade-prompt.ts    채점 시스템 프롬프트 + 응답 JSON 스키마
app/api/grade/route.ts     라우트 핸들러
components/offer/OfferForm.tsx   오퍼 작성 폼
components/report/Report.tsx     결과 리포트(AAR)
```

지켜야 하는 경계:

- **페널티는 코드가 판정한다.** 시나리오 JSON의 페널티에 `detect`가 붙어 있으면 `detectPenalties`가
  숫자 비교로 판정하고, 모델에게는 결과를 사실로 준다. `capAt`(축 점수 상한)도 코드가 강제한다.
  판정을 프롬프트로 부탁하면 상한이 걸릴지 말지가 모델 기분에 달린다.
  문장을 읽어야만 알 수 있는 페널티(`detect` 없는 것)만 프롬프트에 실려 모델이 판정한다.
- **임계값은 회사 마스터 데이터에서만 읽는다.** 밴드 상단·결재 한도 같은 숫자를 `offer.ts`에 적지 않는다.
- **총점과 루브릭 구간은 코드가 계산한다.** 모델은 축별 점수와 코멘트만 낸다.
- **채점 프롬프트는 npc-prompt와 반대 방향이다.** 대화는 정보를 가려서 넣고, 채점은 전부 넣는다.
- **파싱에 실패하면 점수를 지어내지 않는다.** `degraded: true` 리포트를 돌려주고 UI가 다시 채점을 권한다.
- **검증은 양쪽이 한다.** `validateOffer`는 폼 UX용이자 라우트 핸들러의 400 근거다.
- **오퍼는 되돌릴 수 없다.** `submit_offer` 이후 폼은 사라지고, 채점 실패는 오퍼를 롤백하지 않는다.

## 검증

`ANTHROPIC_API_KEY`는 `.env.example`을 `.env.local`로 복사해 채운다. `NEXT_PUBLIC_` 접두사 금지.

```bash
npm run validate    # 데이터 구조·참조 무결성
npm run typecheck   # tsc --noEmit
npm run build       # Next.js 빌드
npm run dev         # http://localhost:3000
```

`npm run dev`가 떠 있는 동안 `npm run build`를 돌리지 않는다. 둘이 같은 `.next`를 쓰기 때문에
청크가 깨져 개발 서버가 `Cannot find module './611.js'` 로 500을 뱉는다.
이미 깨졌다면 dev 서버를 끄고 `.next`를 지운 뒤 다시 띄운다.

## 모델 운용 규칙

**사용 모델은 Sonnet 5와 Opus 5 두 가지뿐이다.**

각 단계를 시작하기 전에 어떤 모델로 작업할지 먼저 알리고, 사용자가 전환한 뒤 진행한다.
모델 전환은 사용자만 할 수 있으므로 Claude는 임의로 바꾸지 않는다.
계획에 없던 작업이 끼어들면 그때도 먼저 모델을 배정해 알린다.

배정 기준: **설계 결정과 프롬프트가 걸린 단계는 Opus 5, 정형화된 구현은 Sonnet 5.**

| 단계 | 모델 | 배정 이유 |
|---|---|---|
| 1. 시나리오 스키마 + 데이터 | Opus 5 | 이후 전 단계가 이 스키마 위에 올라간다. 나중에 고치면 비싸다 |
| 2. 라우팅과 레이아웃 셸 | **Sonnet 5** | 정형화된 스캐폴딩과 Tailwind 마크업. 설계 판단이 거의 없다 |
| 3. NPC 대화 엔진 | **Opus 5** | 상태머신과 LLM의 경계 설계 + 프롬프트. 여기가 무너지면 게임 전체가 붕괴한다 |
| 4. 자료실 열람 추적 | **Sonnet 5** | 단순 상태 추적과 저장 |
| 5. 오퍼 제출 → 채점 → AAR | **Opus 5** | 루브릭 적용, 페널티 판정, 채점 프롬프트, JSON fallback |
| 6. 튜토리얼 | **Sonnet 5** | 온보딩 UI 구현 |

## 진행 상황 (기획서 §11 작업 순서)

- [x] 1. 시나리오 JSON 스키마 정의 + 데이터 1건 작성
- [x] 2. 라우팅과 레이아웃 셸
- [x] 3. NPC 대화 엔진 (API 라우트 + 상태머신)
- [x] 4. 자료실 열람 추적
- [x] 5. 오퍼 제출 → 채점 → AAR
- [x] 6. 튜토리얼
