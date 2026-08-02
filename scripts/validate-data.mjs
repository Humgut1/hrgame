/**
 * 무의존 데이터 검증기.  실행: node scripts/validate-data.mjs
 *
 * JSON Schema 전체 검증이 아니라, 깨지면 게임이 조용히 잘못 굴러가는 것들만 본다.
 *  - 필수 키와 타입
 *  - id 유일성
 *  - 참조 무결성 (companyId / teamId / orgUnitId / companyTable.ref / penalty.axisId)
 *  - 턴·시계 산수가 마감 시각과 맞는지
 *  - 시나리오 숫자가 회사 마스터 데이터와 어긋나지 않는지
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** "compensation.bands" 같은 점 경로를 따라간다. */
function resolvePath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function requireKeys(where, obj, keys) {
  for (const k of keys) {
    if (obj[k] === undefined || obj[k] === null) fail(where, `필수 키 누락: ${k}`);
  }
}

function uniqueIds(where, list, label = "id") {
  const seen = new Set();
  for (const item of list ?? []) {
    if (seen.has(item[label])) fail(where, `${label} 중복: ${item[label]}`);
    seen.add(item[label]);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// 회사
// ---------------------------------------------------------------------------

function validateCompany(company, where) {
  requireKeys(where, company, ["id", "name", "asOf", "orgUnits", "teams", "compensation", "employees"]);

  const orgIds = uniqueIds(`${where}.orgUnits`, company.orgUnits);
  const teamIds = uniqueIds(`${where}.teams`, company.teams);
  uniqueIds(`${where}.employees`, company.employees);

  for (const team of company.teams ?? []) {
    if (!orgIds.has(team.orgUnitId)) {
      fail(`${where}.teams[${team.id}]`, `orgUnitId "${team.orgUnitId}" 가 orgUnits에 없다`);
    }
  }

  const comp = company.compensation ?? {};
  if (comp.salaryUnit !== "KRW_10K") {
    fail(`${where}.compensation`, `salaryUnit은 "KRW_10K"(만원)이어야 한다`);
  }

  for (const band of comp.bands ?? []) {
    if (!(band.min < band.max)) {
      fail(`${where}.bands[${band.level}]`, `min(${band.min}) < max(${band.max}) 이어야 한다`);
    }
  }

  uniqueIds(`${where}.compensation.approvals`, comp.approvals);
  for (const a of comp.approvals ?? []) {
    requireKeys(`${where}.approvals[${a.id}]`, a, ["subject", "finalApprover", "sameDayPossible", "summary"]);
    if (typeof a.sameDayPossible !== "boolean") {
      fail(`${where}.approvals[${a.id}]`, "sameDayPossible은 boolean이어야 한다 (절차 채점의 판정 근거)");
    }
  }

  for (const e of company.employees ?? []) {
    if (!teamIds.has(e.teamId)) {
      fail(`${where}.employees[${e.id}]`, `teamId "${e.teamId}" 가 teams에 없다`);
    }
    const band = (comp.bands ?? []).find((b) => b.level === e.level);
    if (!band) {
      warn(`${where}.employees[${e.id}]`, `레벨 "${e.level}" 에 해당하는 밴드가 없다`);
    } else if (e.salary < band.min || e.salary > band.max) {
      warn(
        `${where}.employees[${e.id}]`,
        `연봉 ${e.salary} 가 ${e.level} 밴드(${band.min}~${band.max}) 밖이다`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 시나리오
// ---------------------------------------------------------------------------

function validateScenario(scn, company, where) {
  requireKeys(where, scn, [
    "id", "schemaVersion", "track", "title", "companyId", "today",
    "player", "clock", "phases", "briefing", "npcDirection", "npcs",
    "documents", "offerForm", "scoring", "aar",
  ]);

  if (scn.companyId !== company.id) {
    fail(where, `companyId "${scn.companyId}" 가 회사 데이터 id "${company.id}" 와 다르다`);
  }
  if (typeof scn.today === "string" && typeof company.asOf === "string") {
    if (!scn.today.startsWith(company.asOf)) {
      warn(where, `today(${scn.today})와 회사 asOf(${company.asOf})의 연월이 다르다`);
    }
  }

  // --- 시계 --------------------------------------------------------------
  const c = scn.clock ?? {};
  requireKeys(`${where}.clock`, c, ["startTime", "deadlineTime", "minutesPerMessage", "maxTurns"]);
  const start = minutes(c.startTime);
  const deadline = minutes(c.deadlineTime);
  const spend = c.minutesPerMessage * c.maxTurns;
  if (deadline <= start) {
    fail(`${where}.clock`, `deadlineTime(${c.deadlineTime})이 startTime(${c.startTime}) 이후여야 한다`);
  } else if (start + spend > deadline) {
    fail(
      `${where}.clock`,
      `턴을 다 쓰면 ${c.minutesPerMessage}×${c.maxTurns}=${spend}분이라 마감(${c.deadlineTime})을 넘긴다`
    );
  } else {
    const slack = deadline - start - spend;
    if (slack > c.minutesPerMessage) {
      warn(`${where}.clock`, `턴을 다 써도 ${slack}분이 남는다. 턴 수나 소모 시간을 조정할 여지가 있다`);
    }
  }

  // --- 국면 --------------------------------------------------------------
  const phaseIds = (scn.phases ?? []).map((p) => p.id);
  uniqueIds(`${where}.phases`, scn.phases);
  const ORDER = ["briefing", "investigate", "decision", "result", "debrief"];
  let prev = -1;
  for (const id of phaseIds) {
    const idx = ORDER.indexOf(id);
    if (idx === -1) fail(`${where}.phases`, `알 수 없는 국면: ${id}`);
    else if (idx < prev) fail(`${where}.phases`, `국면 순서가 뒤집혔다: ${id}`);
    else prev = idx;
  }
  const canSubmit = (scn.phases ?? []).some((p) => (p.allows ?? []).includes("submit_offer"));
  const canMessage = (scn.phases ?? []).some((p) => (p.allows ?? []).includes("message_npc"));
  const canRead = (scn.phases ?? []).some((p) => (p.allows ?? []).includes("read_documents"));
  if (!canSubmit) fail(`${where}.phases`, "submit_offer를 허용하는 국면이 없다");
  if (!canMessage) fail(`${where}.phases`, "message_npc를 허용하는 국면이 없다");
  if (!canRead) fail(`${where}.phases`, "read_documents를 허용하는 국면이 없다");

  // --- NPC ---------------------------------------------------------------
  uniqueIds(`${where}.npcs`, scn.npcs);
  const allSecretIds = new Set();
  let criticalSecrets = 0;
  for (const npc of scn.npcs ?? []) {
    const w = `${where}.npcs[${npc.id}]`;
    requireKeys(w, npc, ["name", "title", "initialTrust", "persona", "openingMessage"]);
    if (npc.initialTrust < 0 || npc.initialTrust > 100) fail(w, `initialTrust는 0~100 (현재 ${npc.initialTrust})`);
    requireKeys(`${w}.persona`, npc.persona ?? {}, ["voice", "goal"]);

    // dataAccess에 적힌 경로만 이 NPC의 프롬프트에 실린다. 오타 나면 조용히 데이터가 빠진다.
    for (const ref of npc.dataAccess ?? []) {
      const resolved = resolvePath(company, ref);
      if (resolved === undefined || resolved === null) {
        fail(`${w}.dataAccess`, `"${ref}" 가 회사 데이터에서 해석되지 않는다`);
      } else if (Array.isArray(resolved) && resolved.length === 0) {
        fail(`${w}.dataAccess`, `"${ref}" 가 빈 배열이다. 프롬프트에 아무것도 실리지 않는다`);
      }
    }

    for (const s of npc.secrets ?? []) {
      const sw = `${w}.secrets[${s.id}]`;
      if (allSecretIds.has(s.id)) fail(sw, `secret id 중복: ${s.id}`);
      allSecretIds.add(s.id);
      requireKeys(sw, s, ["topic", "content", "revealWhen"]);
      const rw = s.revealWhen ?? {};
      requireKeys(`${sw}.revealWhen`, rw, ["requiresSpecificQuestion", "keywords", "minTrust"]);
      if (!Array.isArray(rw.keywords) || rw.keywords.length === 0) {
        fail(`${sw}.revealWhen`, "keywords가 비어 있으면 이 정보는 영원히 나오지 않는다");
      }
      if (typeof rw.minTrust === "number" && rw.minTrust > npc.initialTrust) {
        warn(
          `${sw}.revealWhen`,
          `minTrust(${rw.minTrust})가 초기 신뢰도(${npc.initialTrust})보다 높다. 신뢰를 먼저 쌓아야만 열린다`
        );
      }
      if (s.importance === "critical") criticalSecrets += 1;
    }
  }
  if ((scn.npcs ?? []).length >= 2) {
    const withCritical = (scn.npcs ?? []).filter((n) =>
      (n.secrets ?? []).some((s) => s.importance === "critical")
    );
    if (withCritical.length < 2) {
      warn(
        `${where}.npcs`,
        "critical 숨은 정보를 가진 NPC가 2명 미만이다. 한 명만 붙잡아도 전부 보이는 구조가 된다"
      );
    }
  }
  if (criticalSecrets === 0) warn(`${where}.npcs`, "critical 숨은 정보가 하나도 없다");

  // --- 문서 --------------------------------------------------------------
  uniqueIds(`${where}.documents`, scn.documents);
  for (const doc of scn.documents ?? []) {
    const w = `${where}.documents[${doc.id}]`;
    requireKeys(w, doc, ["title", "kind", "blocks"]);
    if (!Array.isArray(doc.blocks) || doc.blocks.length === 0) {
      fail(w, "blocks가 비어 있다");
      continue;
    }
    doc.blocks.forEach((block, i) => {
      const bw = `${w}.blocks[${i}]`;
      switch (block.type) {
        case "text":
        case "note":
          if (!block.text) fail(bw, `${block.type} 블록에 text가 없다`);
          break;
        case "fields":
          if (!block.items?.length) fail(bw, "fields 블록에 items가 없다");
          break;
        case "table":
          if (!block.columns?.length) fail(bw, "table 블록에 columns가 없다");
          for (const row of block.rows ?? []) {
            if (row.length !== block.columns.length) {
              fail(bw, `행의 칸 수(${row.length})가 columns(${block.columns.length})와 다르다`);
            }
          }
          break;
        case "companyTable": {
          const resolved = resolvePath(company, block.ref);
          if (!Array.isArray(resolved)) {
            fail(bw, `companyTable.ref "${block.ref}" 가 회사 데이터에서 배열로 해석되지 않는다`);
            break;
          }
          const rows = block.filter
            ? resolved.filter((r) => Object.entries(block.filter).every(([k, v]) => r[k] === v))
            : resolved;
          if (rows.length === 0) {
            fail(bw, `companyTable "${block.ref}" 가 필터 후 0행이다. 자료실에 빈 표가 뜬다`);
            break;
          }
          for (const col of block.columns ?? []) {
            const missing = rows.filter((r) => r[col.key] === undefined);
            if (missing.length === rows.length) {
              fail(bw, `컬럼 키 "${col.key}" 가 ${block.ref} 의 어떤 행에도 없다`);
            } else if (missing.length > 0) {
              warn(bw, `컬럼 키 "${col.key}" 가 ${missing.length}/${rows.length} 행에서 비어 있다`);
            }
          }
          break;
        }
        default:
          fail(bw, `알 수 없는 블록 타입: ${block.type}`);
      }
    });
  }

  // --- 오퍼 폼 -----------------------------------------------------------
  const form = scn.offerForm ?? {};
  requireKeys(`${where}.offerForm`, form, ["title", "irreversible", "fields"]);
  uniqueIds(`${where}.offerForm.fields`, form.fields);
  const fieldIds = new Set((form.fields ?? []).map((f) => f.id));
  for (const f of form.fields ?? []) {
    const fw = `${where}.offerForm.fields[${f.id}]`;
    requireKeys(fw, f, ["label", "type", "required"]);
    if (!["number", "boolean", "textarea"].includes(f.type)) fail(fw, `알 수 없는 타입: ${f.type}`);
    if (f.type === "number" && f.min !== undefined && f.max !== undefined && f.min > f.max) {
      fail(fw, `min(${f.min}) > max(${f.max})`);
    }
  }
  if (!(scn.offerForm?.fields ?? []).some((f) => f.type === "textarea" && f.required)) {
    warn(`${where}.offerForm`, "필수 자유 서술 필드가 없다. 기획 원칙상 메시지는 필수여야 한다");
  }

  // --- 채점 --------------------------------------------------------------
  const scoring = scn.scoring ?? {};
  requireKeys(`${where}.scoring`, scoring, ["axes", "strictness"]);
  const axisIds = uniqueIds(`${where}.scoring.axes`, scoring.axes);
  for (const axis of scoring.axes ?? []) {
    requireKeys(`${where}.scoring.axes[${axis.id}]`, axis, ["name", "criteria"]);
  }
  uniqueIds(`${where}.scoring.penalties`, scoring.penalties);
  const approvalIds = new Set((company.compensation?.approvals ?? []).map((a) => a.id));
  for (const p of scoring.penalties ?? []) {
    const pw = `${where}.scoring.penalties[${p.id}]`;
    requireKeys(pw, p, ["when", "effect"]);
    if (p.axisId && !axisIds.has(p.axisId)) fail(pw, `axisId "${p.axisId}" 가 axes에 없다`);
    if (p.capAt !== undefined && (p.capAt < 0 || p.capAt > 100)) fail(pw, `capAt은 0~100 (현재 ${p.capAt})`);

    // capAt은 코드가 강제하는 상한이다. 판정까지 LLM에 맡기면 상한이 걸릴지 말지가 모델 기분에 달린다.
    if (p.capAt !== undefined && !p.detect) {
      fail(pw, "capAt이 있는데 detect가 없다. 점수 상한은 코드가 결정론적으로 판정해야 한다");
    }

    // detect가 가리키는 필드·결재 항목이 실제로 있어야 한다. 오타 나면 페널티가 조용히 안 걸린다.
    const d = p.detect;
    if (!d) continue;
    const needsField = ["booleanField", "exceedsBandMax", "exceedsApprovalLimit"];
    if (needsField.includes(d.kind)) {
      if (!d.field) fail(`${pw}.detect`, `kind=${d.kind} 에는 field가 필요하다`);
      else if (!fieldIds.has(d.field)) {
        fail(`${pw}.detect`, `field "${d.field}" 가 offerForm.fields에 없다`);
      }
    }
    if (d.kind === "exceedsApprovalLimit") {
      if (!d.approvalId) fail(`${pw}.detect`, "kind=exceedsApprovalLimit 에는 approvalId가 필요하다");
      else if (!approvalIds.has(d.approvalId)) {
        fail(`${pw}.detect`, `approvalId "${d.approvalId}" 가 회사 결재 항목에 없다`);
      } else {
        const approval = company.compensation.approvals.find((a) => a.id === d.approvalId);
        if (typeof approval.limitPerPerson !== "number") {
          fail(`${pw}.detect`, `결재 항목 "${d.approvalId}" 에 limitPerPerson이 없어 한도를 판정할 수 없다`);
        }
      }
    }
    if (d.kind === "exceedsBandMax") {
      const band = (company.compensation?.bands ?? []).find((b) => b.level === scn.position?.level);
      if (!band) {
        fail(`${pw}.detect`, `position.level "${scn.position?.level}" 에 해당하는 밴드가 없어 상한을 판정할 수 없다`);
      }
    }
  }

  // --- AAR ---------------------------------------------------------------
  uniqueIds(`${where}.aar.sections`, scn.aar?.sections);
  for (const s of scn.aar?.sections ?? []) {
    requireKeys(`${where}.aar.sections[${s.id}]`, s, ["title", "kind"]);
  }
  if (!(scn.aar?.sections ?? []).some((s) => s.kind === "scores")) {
    fail(`${where}.aar`, "kind=scores 섹션이 없다. 5축 점수를 실을 곳이 없다");
  }

  // --- 채용 트랙 정합성 --------------------------------------------------
  if (scn.track?.id === "recruit" && scn.candidate && scn.position) {
    const bands = company.compensation?.bands ?? [];
    const band = bands.find((b) => b.level === scn.position.level);
    if (!band) {
      fail(`${where}.position`, `레벨 "${scn.position.level}" 이 회사 밴드에 없다`);
    } else {
      const ask = scn.candidate?.ask?.salary;
      if (typeof ask === "number" && ask <= band.max) {
        warn(
          `${where}.candidate`,
          `요구 연봉 ${ask} 가 ${band.level} 밴드 상단 ${band.max} 이하다. 딜레마가 성립하지 않는다`
        );
      }
      const salaryField = (form.fields ?? []).find((f) => f.id === "contractSalary");
      if (salaryField && salaryField.max !== undefined && salaryField.max < band.max) {
        fail(`${where}.offerForm`, `contractSalary.max(${salaryField.max})가 밴드 상단(${band.max})보다 작다`);
      }
    }
    const sbField = (form.fields ?? []).find((f) => f.id === "signingBonus");
    const sbRule = (company.compensation?.approvals ?? []).find((a) => a.id === "signing-bonus");
    if (sbField && sbRule?.limitPerPerson && sbField.max !== undefined) {
      if (sbField.max <= sbRule.limitPerPerson) {
        warn(
          `${where}.offerForm`,
          `signingBonus.max(${sbField.max})가 한도(${sbRule.limitPerPerson}) 이하다. 한도 초과 실수를 폼에서 원천 차단하면 절차 축을 채점할 수 없다`
        );
      }
    }
    if (!fieldIds.has("messageToCandidate")) {
      warn(`${where}.offerForm`, "채용 트랙인데 후보자에게 보낼 메시지 필드가 없다");
    }
  }
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

const companies = new Map();
for (const file of readdirSync(join(DATA, "companies")).filter((f) => f.endsWith(".json"))) {
  const where = `companies/${file}`;
  try {
    const company = readJson(join(DATA, "companies", file));
    validateCompany(company, where);
    companies.set(company.id, company);
  } catch (e) {
    fail(where, `읽기/파싱 실패 — ${e.message}`);
  }
}

let scenarioCount = 0;
for (const file of readdirSync(join(DATA, "scenarios")).filter((f) => f.endsWith(".json"))) {
  const where = `scenarios/${file}`;
  try {
    const scn = readJson(join(DATA, "scenarios", file));
    const company = companies.get(scn.companyId);
    if (!company) {
      fail(where, `companyId "${scn.companyId}" 에 해당하는 회사 데이터가 없다`);
      continue;
    }
    validateScenario(scn, company, where);
    scenarioCount += 1;
  } catch (e) {
    fail(where, `읽기/파싱 실패 — ${e.message}`);
  }
}

console.log(`회사 ${companies.size}건, 시나리오 ${scenarioCount}건 검사`);
for (const w of warnings) console.log(`  경고  ${w}`);
for (const e of errors) console.log(`  오류  ${e}`);

if (errors.length) {
  console.log(`\n실패: 오류 ${errors.length}건, 경고 ${warnings.length}건`);
  process.exit(1);
}
console.log(`\n통과: 오류 없음, 경고 ${warnings.length}건`);
