/**
 * data/ 아래 JSON을 읽는 서버 전용 로더.
 * 클라이언트 컴포넌트에서 import하지 말 것 — node:fs가 들어 있다.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type {
  ClientScenario,
  Company,
  CompanyTableBlock,
  Scenario,
  ScenarioDocument,
} from "@/types/scenario";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * MVP는 스테이지 1건이라 워크스페이스가 이 시나리오를 연다.
 * 트랙이 늘어나면 세션 상태에서 읽도록 바꾼다. (기획서 §3)
 */
export const ACTIVE_SCENARIO_ID = "recruit-03-offer-negotiation";

// 데이터는 프로세스 수명 동안 바뀌지 않는다. dev에서는 모듈이 다시 평가되면서 캐시도 비워진다.
const companyCache = new Map<string, Company>();
const scenarioCache = new Map<string, Scenario>();

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadCompany(companyId: string): Company {
  const cached = companyCache.get(companyId);
  if (cached) return cached;

  const company = readJson<Company>(path.join(DATA_DIR, "companies", `${companyId}.json`));
  companyCache.set(companyId, company);
  return company;
}

export function loadScenario(scenarioId: string): Scenario {
  const cached = scenarioCache.get(scenarioId);
  if (cached) return cached;

  const scenario = readJson<Scenario>(
    path.join(DATA_DIR, "scenarios", `${scenarioId}.json`)
  );
  scenarioCache.set(scenarioId, scenario);
  return scenario;
}

/** 시나리오와 그 회사 데이터를 한 번에. 페이지는 보통 이걸 쓴다. */
export function loadStage(scenarioId: string): { scenario: Scenario; company: Company } {
  const scenario = loadScenario(scenarioId);
  return { scenario, company: loadCompany(scenario.companyId) };
}

export function listScenarios(): Scenario[] {
  return readdirSync(path.join(DATA_DIR, "scenarios"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadScenario(f.replace(/\.json$/, "")))
    .sort((a, b) => a.track.stage - b.track.stage);
}

export function findDocument(
  scenario: Scenario,
  docId: string
): ScenarioDocument | undefined {
  return scenario.documents.find((d) => d.id === docId);
}

/**
 * 클라이언트로 내보내도 되는 부분만 남긴다.
 *
 * secrets / npcDirection / scoring / persona 는 여기서 통째로 잘려 나간다.
 * 서버 컴포넌트가 Scenario를 클라이언트 컴포넌트 props로 넘기면 그 값이 RSC 페이로드에
 * 직렬화되므로, 클라이언트로 가는 경로는 전부 이 함수를 통과해야 한다.
 */
export function toClientScenario(scenario: Scenario): ClientScenario {
  return {
    id: scenario.id,
    title: scenario.title,
    today: scenario.today,
    player: scenario.player,
    clock: scenario.clock,
    npcs: scenario.npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      title: npc.title,
      avatar: npc.avatar,
      relationToPlayer: npc.relationToPlayer,
      initialTrust: npc.initialTrust,
      openingMessage: npc.openingMessage,
    })),
    documentIds: scenario.documents.map((d) => d.id),
  };
}

// ---------------------------------------------------------------------------
// companyTable 리졸버
// ---------------------------------------------------------------------------

/** "compensation.bands" 같은 점 경로를 따라간다. */
function resolvePath(source: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function formatCell(
  value: unknown,
  format: CompanyTableBlock["columns"][number]["format"]
): string {
  if (value === undefined || value === null) return "—";
  if (format === "number" && typeof value === "number") {
    return value.toLocaleString("ko-KR");
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export interface ResolvedTable {
  columns: string[];
  rows: string[][];
  /** 오른쪽 정렬할 컬럼 인덱스 */
  numericColumns: number[];
}

/**
 * companyTable 블록을 회사 마스터 데이터로 실제 표로 바꾼다.
 * 급여·밴드·재직자의 진실이 회사 JSON 한 곳에만 있게 하는 장치.
 */
export function resolveCompanyTable(
  company: Company,
  block: CompanyTableBlock
): ResolvedTable {
  const resolved = resolvePath(company, block.ref);
  if (!Array.isArray(resolved)) {
    throw new Error(`companyTable.ref "${block.ref}" 가 배열로 해석되지 않습니다.`);
  }

  const source = resolved as Record<string, unknown>[];
  const rows = block.filter
    ? source.filter((row) =>
        Object.entries(block.filter!).every(([key, want]) => row[key] === want)
      )
    : source;

  return {
    columns: block.columns.map((c) => c.label),
    rows: rows.map((row) =>
      block.columns.map((col) => {
        if (col.format === "range" && col.rangeWith) {
          return `${formatCell(row[col.key], "number")} ~ ${formatCell(row[col.rangeWith], "number")}`;
        }
        return formatCell(row[col.key], col.format);
      })
    ),
    numericColumns: block.columns.flatMap((col, i) =>
      col.format === "number" || col.format === "range" ? [i] : []
    ),
  };
}

// ---------------------------------------------------------------------------
// 조회 헬퍼 — 채점과 UI가 같은 사실을 보게 한다
// ---------------------------------------------------------------------------

export function findBand(company: Company, level: string) {
  return company.compensation.bands.find((b) => b.level === level);
}

export function findApproval(company: Company, approvalId: string) {
  return company.compensation.approvals.find((a) => a.id === approvalId);
}
