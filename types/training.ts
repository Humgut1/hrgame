/**
 * 교육 모드(Grow → TalentCore·Hire) 데이터 모델.
 *
 * 시뮬레이터(types/scenario.ts)와 일부러 분리한다. 시뮬레이터는 "판단을 연습하는"
 * 열린 대화고, 교육은 "프로그램 쓰는 법을 익히는" 정해진 이야기다.
 * 이야기는 한 줄로 흐르고, 진짜 작업은 진짜 화면(TalentCore·Hire)에서 한다.
 */

/** 도움 단계 — 같은 미션을 세 가지 난이도로 돌려 쓴다. */
export type HelpLevel = "follow" | "hint" | "test";

/** 판단 체크의 답 — 반드시 2개, 하나만 맞다. 틀려도 이야기는 갈라지지 않는다. */
export interface Answer {
  t: string;
  ok?: boolean;
  /** 맞았을 때는 왜 맞는지, 틀렸을 때는 현업에서 무슨 일이 생기는지. */
  why: string;
}

/** 데이터 확인 — 진짜 화면에서 한 일을 TalentCore 기록으로 본다. */
export interface Check {
  kind: "requisition" | "openings";
  /** 이번 판에서 만든 것만 보도록 미션 시작 시각 이후로 좁힌다. */
  find: { titleHas?: string; deptIs?: string };
  /** 위에서부터 본다. 처음 어긋난 항목이 '틀림'이 된다. */
  want: Want[];
  /** 아무것도 못 찾았을 때(= 아직 안 함) 보여 줄 말. */
  todo: string;
}

export interface Want {
  /** checks.ts 의 FIELDS 키 */
  field: string;
  /** 같아야 하는 값. 배열이면 그중 하나. */
  is?: string | number | (string | number)[];
  /** 이상이어야 하는 값(숫자). */
  min?: number;
  /** 어긋났을 때 보여 줄 말. {got} 은 실제 값으로 바뀐다. */
  msg: string;
}

export type Scene =
  | { k: "say"; who: string; t: string }
  | { k: "me"; t: string }
  | { k: "note"; t: string }
  | { k: "ask"; who: string; q: string; a: [Answer, Answer] }
  | {
      k: "do";
      who: string;
      t: string;
      /** 진짜 화면 주소 (TalentCore·Hire) */
      open?: string;
      openLabel?: string;
      steps: string[];
      hint: string;
      check: Check;
    };

export interface Mission {
  id: string;
  title: string;
  /** 어디서 하는 일인가 — 화면 라벨 */
  where: string;
  goal: string;
  ready?: boolean;
  scenes?: Scene[];
}

export interface Cast {
  id: string;
  name: string;
  title: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  /** 배우는 사람이 맡는 역할 */
  /** 이 과정을 받는 세부 직무(TalentCore job_profiles.code). 없으면 누구에게나 열린다. */
  profiles?: string[];
  me: { name: string; title: string };
  cast: Cast[];
  missions: Mission[];
}

/** 검사 결과 — 정상 / 틀림 / 안 함, 그리고 붙일 수 없을 때. */
export type CheckState = "ok" | "wrong" | "todo" | "offline";

export interface CheckResult {
  state: CheckState;
  msg: string;
  /** 어긋난 항목 이름 (확인 시험 단계에서 이것만 보여 준다) */
  field?: string;
}
