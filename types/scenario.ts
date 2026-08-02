/**
 * data/schema/*.schema.json 의 TypeScript 미러.
 * 스키마를 고치면 이 파일도 같이 고친다. 진실은 JSON Schema 쪽에 있다.
 */

// ---------------------------------------------------------------------------
// 회사 마스터 데이터
// ---------------------------------------------------------------------------

/** 모든 연봉·보너스 금액의 단위는 만원이다. */
export type SalaryUnit = "KRW_10K";

export interface OrgUnit {
  id: string;
  name: string;
  headcount: number;
}

export interface Team {
  id: string;
  name: string;
  /** OrgUnit.id */
  orgUnitId: string;
  headcount?: number;
  leaderName?: string;
  composition?: { role: string; count: number }[];
}

export interface SalaryBand {
  level: string;
  jobFamily?: string;
  /** 만원 */
  min: number;
  /** 만원 */
  max: number;
  note?: string;
}

export interface ApprovalRule {
  id: string;
  subject: string;
  chain?: string[];
  finalApprover: string;
  leadTimeBusinessDays?: [number, number];
  cadence?: string;
  nextDecisionAt?: string;
  /** 만원 */
  limitPerPerson?: number;
  clawback?: string;
  /** 절차 축 채점의 핵심 판정 근거. */
  sameDayPossible: boolean;
  /** 표에 그대로 렌더할 한 줄 요약 */
  summary: string;
}

export interface HeadcountPlan {
  period: string;
  remaining: number;
  closedLevels?: string[];
  note?: string;
}

export interface Employee {
  id: string;
  name: string;
  /** Team.id */
  teamId: string;
  jobFamily?: string;
  level: string;
  levelLabel?: string;
  /** YYYY-MM */
  joinedAt: string;
  /** 만원 */
  salary: number;
  lastReviewGrade?: string;
  lastReviewYear?: number;
}

export interface Company {
  id: string;
  name: string;
  nameEn?: string;
  product?: { name: string; description: string };
  /** YYYY-MM */
  foundedAt?: string;
  location?: string;
  /** YYYY-MM. 시나리오의 today와 어긋나면 안 된다. */
  asOf: string;
  headcount?: number;
  funding?: { round: string; amountKRW: number; closedAt: string }[];
  financials?: {
    fiscalYear: number;
    revenueKRW: number;
    operatingProfitKRW: number;
    note?: string;
  }[];
  orgUnits: OrgUnit[];
  teams: Team[];
  compensation: {
    salaryUnit: SalaryUnit;
    policy?: string[];
    annualReviewMonth?: number;
    bands: SalaryBand[];
    approvals: ApprovalRule[];
    headcountPlan?: HeadcountPlan[];
  };
  employees: Employee[];
}

// ---------------------------------------------------------------------------
// 시나리오
// ---------------------------------------------------------------------------

export type TrackId = "recruit" | "hr-ops" | "compensation" | "labor" | "er";

/** 상태머신이 강제하는 국면. LLM은 이걸 바꿀 수 없다. */
export type PhaseId = "briefing" | "investigate" | "decision" | "result" | "debrief";

export type PhaseAction =
  | "read_documents"
  | "message_npc"
  | "submit_offer"
  | "view_report";

export interface Phase {
  id: PhaseId;
  name: string;
  description?: string;
  allows: PhaseAction[];
  advanceOn?:
    | "acknowledge"
    | "player_action"
    | "turns_exhausted_or_submit"
    | "submit_offer"
    | "grade_complete";
}

export interface Clock {
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  deadlineTime: string;
  deadlineLabel?: string;
  minutesPerMessage: number;
  /** 턴 = 플레이어가 NPC에게 보내는 메시지 1건 */
  maxTurns: number;
  documentReadCostsTurn?: boolean;
}

export interface NpcSecret {
  id: string;
  topic: string;
  content: string;
  importance?: "critical" | "helpful";
  unlocks?: string;
  revealWhen: {
    requiresSpecificQuestion: boolean;
    keywords: string[];
    minTrust: number;
  };
}

export interface Npc {
  id: string;
  name: string;
  title: string;
  age?: number;
  avatar?: string;
  relationToPlayer?: string;
  /** 0~100. 스테이지를 넘어 누적된다. */
  initialTrust: number;
  persona: {
    voice: string;
    goal: string;
    pressureTactic?: string;
    /** 먼저 말하지 않는다. */
    hiddenCircumstance?: string;
  };
  knows?: string[];
  /** 모른다고 답해야 하는 것 */
  doesNotKnow?: string[];
  /**
   * 프롬프트에 실어 줄 회사 마스터 데이터의 점 경로("compensation.bands" 등).
   * 여기 없는 데이터는 프롬프트에 들어가지 않으므로 이 NPC는 인용할 수 없다.
   */
  dataAccess?: string[];
  openingMessage: string;
  secrets?: NpcSecret[];
}

export interface NpcDirection {
  /** LLM 프롬프트에 그대로 삽입된다. */
  rules: string[];
  trustBehavior?: { atLeast?: number; below: number; behavior: string }[];
  trustRules: { when: string; delta: [number, number] }[];
}

// --- 자료실 문서 블록 -------------------------------------------------------

export interface TextBlock {
  type: "text";
  heading?: string;
  text: string;
}

export interface FieldsBlock {
  type: "fields";
  heading?: string;
  items: { label: string; value: string; emphasis?: boolean }[];
}

export interface TableBlock {
  type: "table";
  heading?: string;
  columns: string[];
  rows: string[][];
}

/** 회사 마스터 데이터를 경로로 참조한다. 급여·밴드·재직자의 진실은 회사 JSON에만 있다. */
export interface CompanyTableBlock {
  type: "companyTable";
  heading?: string;
  /** 예: "compensation.bands", "employees" */
  ref: string;
  filter?: Record<string, string>;
  columns: {
    key: string;
    label: string;
    format?: "text" | "number" | "range";
    rangeWith?: string;
  }[];
}

export interface NoteBlock {
  type: "note";
  text: string;
}

export type DocBlock =
  | TextBlock
  | FieldsBlock
  | TableBlock
  | CompanyTableBlock
  | NoteBlock;

export interface ScenarioDocument {
  id: string;
  title: string;
  kind: string;
  issuedAt?: string;
  summary?: string;
  blocks: DocBlock[];
}

// --- 오퍼 폼 ---------------------------------------------------------------

export interface OfferField {
  id: string;
  label: string;
  type: "number" | "boolean" | "textarea";
  unit?: string;
  required: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  placeholder?: string;
  help?: string;
}

export interface OfferForm {
  title: string;
  description?: string;
  irreversible: boolean;
  confirmText?: string;
  fields: OfferField[];
}

// --- 채점 -----------------------------------------------------------------

export interface ScoringAxis {
  id: string;
  name: string;
  criteria: string;
  weight?: number;
  looksLike?: { high?: string[]; low?: string[] };
}

/**
 * 페널티를 코드가 결정론적으로 판정하는 규칙.
 * 임계값(밴드 상단·전결 한도)은 회사 마스터 데이터에서 읽으므로 여기에 숫자를 적지 않는다.
 */
export interface PenaltyDetect {
  kind:
    | "booleanField"
    | "exceedsBandMax"
    | "exceedsApprovalLimit"
    | "noDocumentsRead"
    | "singleNpcOnly";
  /** offerForm.fields[].id */
  field?: string;
  /** company.compensation.approvals[].id */
  approvalId?: string;
}

export interface Penalty {
  id: string;
  when: string;
  effect: string;
  axisId?: string;
  /** 해당 축 점수의 상한 */
  capAt?: number;
  /** 없으면 채점 LLM이 판정한다 — 문장을 읽어야 알 수 있는 페널티가 그렇다. */
  detect?: PenaltyDetect;
}

export interface Scoring {
  strictness: string;
  rubricBands?: { min: number; label: string; meaning: string }[];
  axes: ScoringAxis[];
  modelSolution?: {
    summary: string;
    components?: string[];
    rationale?: string;
    disclaimer?: string;
  };
  penalties?: Penalty[];
}

// --- AAR -------------------------------------------------------------------

export interface AarSection {
  id: string;
  title: string;
  kind: "outcome" | "scores" | "prose" | "bullets" | "timeline";
  /** 채점 LLM에게 주는 생성 지시 */
  instruction?: string;
  bulletCount?: number;
}

export interface Aar {
  sections: AarSection[];
  outcomeOptions?: string[];
}

// --- 트랙별 확장 -----------------------------------------------------------
// 스키마에서는 additionalProperties: true 인 자유 슬롯이다.
// 트랙이 늘어나면 여기에 타입을 추가하고 Scenario의 유니온에 끼운다.

export interface RecruitPosition {
  orgUnit: string;
  team: string;
  title: string;
  /** SalaryBand.level */
  level: string;
  requestedBy: string;
  requestedAt: string;
  elapsed?: string;
  approvedHeadcount?: number;
  reason?: string;
  funnel?: { step: string; count: number }[];
}

export interface RecruitCandidate {
  name: string;
  age?: number;
  totalExperienceYears?: number;
  current: {
    company: string;
    role?: string;
    tenure?: string;
    /** 만원 */
    salary: number;
    equity?: string;
  };
  ask: {
    /** 만원 */
    salary: number;
    reason?: string;
  };
  assessment?: { strength?: string; gap?: string; verdict?: string };
  competingOffer?: { company: string; deadline?: string; note?: string };
  responseDeadline?: string;
}

// --- 시나리오 --------------------------------------------------------------

export interface Scenario {
  id: string;
  schemaVersion: number;
  track: { id: TrackId; name: string; stage: number };
  title: string;
  summary?: string;
  estimatedMinutes?: number;
  /** data/companies/<id>.json */
  companyId: string;
  /** YYYY-MM-DD. 게임 내 오늘. */
  today: string;
  player: {
    name: string;
    team: string;
    role: string;
    tenure?: string;
    /** NPC가 부르는 호칭 */
    addressedAs?: string;
  };
  clock: Clock;
  phases: Phase[];
  briefing: {
    headline: string;
    situation: string[];
    objective: string;
    constraints?: string[];
  };
  /** 트랙별 확장 슬롯. 채용 트랙에서만 쓴다. */
  candidate?: RecruitCandidate;
  position?: RecruitPosition;
  npcDirection: NpcDirection;
  npcs: Npc[];
  documents: ScenarioDocument[];
  offerForm: OfferForm;
  scoring: Scoring;
  aar: Aar;
}

// ---------------------------------------------------------------------------
// 브라우저로 내보내도 되는 부분집합
// ---------------------------------------------------------------------------
// Scenario를 클라이언트 컴포넌트에 그대로 넘기면 secrets·npcDirection·scoring이
// RSC 페이로드에 실려 devtools에서 그대로 읽힌다. 게임이 그 자리에서 무너진다.
// 클라이언트로 가는 건 반드시 이 타입으로 좁혀서 보낸다. (lib/data.ts toClientScenario)

export interface ClientNpc {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  relationToPlayer?: string;
  initialTrust: number;
  openingMessage: string;
}

export interface ClientScenario {
  id: string;
  title: string;
  today: string;
  player: Scenario["player"];
  clock: Clock;
  npcs: ClientNpc[];
  /** 열람 추적(4단계)용. 본문은 서버에서만 렌더한다. */
  documentIds: string[];
}
