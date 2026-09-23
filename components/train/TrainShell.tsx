"use client";

/**
 * 교육 모드 화면. 이야기는 한 줄로 흐르고, 진짜 작업은 TalentCore·Hire 진짜 화면에서 한다.
 *
 * 지키는 규칙 세 가지:
 *  - 판단 체크는 답이 둘. 틀려도 이야기는 갈라지지 않는다(왜 틀렸는지 듣고 제자리로).
 *  - 작업은 화면에서 하고, 확인은 TalentCore 기록으로 한다(정상 / 틀림 / 안 함).
 *  - 같은 미션을 도움 단계 셋으로 돌려 쓴다(따라 하기 / 힌트만 / 확인 시험).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearProgress,
  emptyProgress,
  loadProgress,
  saveProgress,
  type Progress,
} from "@/lib/train/progress";
import type { CheckResult, Course, HelpLevel, Mission, Scene } from "@/types/training";
import { josa } from "@/lib/train/josa";

const HELP: { id: HelpLevel; label: string; hint: string }[] = [
  { id: "follow", label: "따라 하기", hint: "순서를 그대로 보여 줍니다" },
  { id: "hint", label: "힌트만", hint: "한 줄 힌트만 보여 줍니다" },
  { id: "test", label: "확인 시험", hint: "도움 없이 해 봅니다" },
];

/** 멈춰 서야 하는 장면(판단 체크·작업)만 차례를 잡는다. 이야기 줄은 그냥 흘려보낸다. */
const stops = (s: Scene) => s.k === "ask" || s.k === "do";

function nextStop(scenes: Scene[], from: number): number {
  for (let i = from; i < scenes.length; i += 1) if (stops(scenes[i])) return i;
  return scenes.length;
}

/** 화면에 보여 줄 배우는 사람 — TalentCore 에서 읽은 값(열쇠·기록 원본은 서버에). */
export interface ClientLearner {
  id: string;
  name: string;
  dept: string;
  position: string;
  profile: { code: string; name: string; summary: string } | null;
}

export function TrainShell({
  course,
  learner = null,
  saved,
}: {
  course: Course;
  learner?: ClientLearner | null;
  /** TalentCore 에 적혀 있던 진행·수료 */
  saved?: { state?: Progress | null; completedAt?: string | null };
}) {
  const owner = learner?.id;
  const first = course.missions.find((m) => m.ready)?.id ?? course.missions[0].id;
  const [p, setP] = useState<Progress>(() => emptyProgress(course.id, first));
  const [ready, setReady] = useState(false);
  const [why, setWhy] = useState<{ ok: boolean; t: string } | null>(null);
  const [res, setRes] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [openSteps, setOpenSteps] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "fail">("idle");
  const [completedAt, setCompletedAt] = useState<string | null>(saved?.completedAt ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 이 브라우저 것과 TalentCore 것 중 나중에 바꾼 쪽에서 이어 간다.
    const local = loadProgress(course.id, owner);
    const remote = saved?.state && saved.state.courseId === course.id ? saved.state : undefined;
    const pickP =
      local && remote ? ((local.savedAt ?? 0) >= (remote.savedAt ?? 0) ? local : remote) : local ?? remote;
    if (pickP) setP(pickP);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, owner]);

  /** TalentCore 에 적기 — 연달아 바뀌면 마지막 것만 보낸다. */
  const push = (next: Progress) => {
    if (!learner) return;
    if (timer.current) clearTimeout(timer.current);
    setSync("saving");
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/train/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: course.id, profile: learner.profile?.code ?? null, state: next }),
        });
        const j = (await r.json()) as { ok: boolean; completed_at?: string | null };
        setSync(j.ok ? "saved" : "fail");
        if (j.ok && j.completed_at) setCompletedAt(j.completed_at);
      } catch {
        setSync("fail");
      }
    }, 700);
  };

  const put = (next: Progress) => {
    const stamped = { ...next, savedAt: Date.now() };
    setP(stamped);
    saveProgress(stamped, owner);
    push(stamped);
  };

  const mission: Mission = course.missions.find((m) => m.id === p.cur) ?? course.missions[0];
  const scenes = mission.scenes ?? [];
  const mp = p.missions[mission.id] ?? { at: nextStop(scenes, 0) };
  const at = mp.at;
  const cur: Scene | undefined = scenes[at];
  const doneMission = at >= scenes.length;

  const name = (who: string) => course.cast.find((c) => c.id === who)?.name ?? who;
  const role = (who: string) => course.cast.find((c) => c.id === who)?.title ?? "";

  const setMission = (id: string) => {
    const m = course.missions.find((x) => x.id === id);
    if (!m?.ready) return;
    const prev = p.missions[id];
    setWhy(null);
    setRes(null);
    setOpenSteps(false);
    put({
      ...p,
      cur: id,
      missions: {
        ...p.missions,
        [id]: prev ?? { at: nextStop(m.scenes ?? [], 0), startedAt: new Date().toISOString() },
      },
    });
  };

  // 첫 진입에 미션 시작 시각을 남긴다 — 확인은 이 시각 이후 기록만 본다.
  useEffect(() => {
    if (!ready) return;
    if (p.missions[mission.id]?.startedAt) return;
    put({
      ...p,
      missions: {
        ...p.missions,
        [mission.id]: {
          at: p.missions[mission.id]?.at ?? nextStop(scenes, 0),
          startedAt: new Date().toISOString(),
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mission.id]);

  const advance = () => {
    const to = nextStop(scenes, at + 1);
    setWhy(null);
    setRes(null);
    setOpenSteps(false);
    put({
      ...p,
      missions: { ...p.missions, [mission.id]: { ...mp, at: to, done: to >= scenes.length } },
    });
  };

  const pick = (i: number) => {
    if (cur?.k !== "ask") return;
    const a = cur.a[i];
    setWhy({ ok: !!a.ok, t: a.why });
    const picks = { ...(mp.picks ?? {}), [String(at)]: i };
    const nextMp = a.ok ? { ...mp, picks } : { ...mp, picks, wrongs: (mp.wrongs ?? 0) + 1 };
    put({ ...p, missions: { ...p.missions, [mission.id]: nextMp } });
  };

  /**
   * 연습 회사 문을 연다. 표(2분·일회용)는 서버에서 받아 오고 주소만 새 창에 넣는다.
   * 창을 먼저 열어 두는 이유: 표를 받아 온 뒤에 열면 브라우저가 팝업으로 보고 막는다.
   */
  const openCore = async (next?: string) => {
    const pre = window.open("", "_blank");        // 표를 받기 전에 먼저 열어 둔다
    setNote(null);
    setLink(null);
    setGateBusy(true);
    try {
      const r = await fetch("/api/train/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      const j = (await r.json()) as { ok: boolean; url?: string; msg?: string };
      if (!j.ok || !j.url) {
        pre?.close();
        setNote(j.msg ?? "연습 회사를 열지 못했습니다.");
        return;
      }
      if (pre) {
        pre.location.href = j.url;
        return;
      }
      if (window.open(j.url, "_blank")) return;
      // 새 창이 막힌 브라우저 — 표는 멀쩡하니 직접 누를 링크를 내준다(2분).
      setLink(j.url);
      setNote("브라우저가 새 창을 막았습니다. 아래 링크를 2분 안에 눌러 주세요.");
    } catch {
      pre?.close();
      setNote("연습 회사를 열지 못했습니다.");
    } finally {
      setGateBusy(false);
    }
  };

  /** 연습 회사 데이터를 처음 상태로. 실제 회사 데이터는 건드리지 않는다. */
  const resetCompany = async () => {
    if (!window.confirm("연습 회사에서 만든 요청서·포지션을 모두 지우고 처음 상태로 되돌립니다. 계속할까요?")) return;
    setNote(null);
    setGateBusy(true);
    try {
      const r = await fetch("/api/train/reset", { method: "POST" });
      const j = (await r.json()) as { ok: boolean; msg: string };
      setNote(j.msg);
    } catch {
      setNote("되돌리지 못했습니다.");
    } finally {
      setGateBusy(false);
    }
  };

  const check = async () => {
    if (cur?.k !== "do") return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/train/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          missionId: mission.id,
          scene: at,
          since: mp.startedAt,
        }),
      });
      setRes((await r.json()) as CheckResult);
    } catch {
      setRes({ state: "offline", msg: "확인 요청이 실패했습니다. 잠시 뒤 다시 눌러 주세요." });
    } finally {
      setBusy(false);
    }
  };

  const played = useMemo(() => scenes.slice(0, Math.min(at, scenes.length)), [scenes, at]);

  if (!ready) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
      <aside className="shrink-0 md:w-64">
        {learner ? (
          <div className="mb-3 rounded border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-ink">{learner.name}</div>
                <div className="truncate text-[11px] text-muted">
                  {[learner.dept, learner.position].filter(Boolean).join(" · ")}
                </div>
              </div>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="shrink-0 text-[11px] font-bold text-muted hover:underline">
                  로그아웃
                </button>
              </form>
            </div>
            {learner.profile ? (
              <div className="mt-2 text-[11.5px] text-ink-soft">
                세부 직무 <b className="text-ink">{learner.profile.name}</b>
              </div>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
              {completedAt ? (
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-success-text">
                  수료 {completedAt.slice(0, 10).replaceAll("-", ".")}
                </span>
              ) : null}
              <span className={sync === "fail" ? "text-warning-text" : "text-muted"}>
                {sync === "saving"
                  ? "TalentCore 에 저장 중"
                  : sync === "saved"
                    ? "TalentCore 에 저장됨"
                    : sync === "fail"
                      ? "TalentCore 저장 못 함 — 이 브라우저에는 남음"
                      : "기록은 TalentCore 프로필에 남습니다"}
              </span>
            </div>
          </div>
        ) : null}
        <div className="rounded border border-line bg-surface p-4">
          <div className="text-[11px] font-bold text-muted">교육</div>
          <h1 className="mt-1 text-[15px] font-bold text-ink">{course.title}</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{course.subtitle}</p>
        </div>

        <nav className="mt-3 rounded border border-line bg-surface">
          {course.missions.map((m, i) => {
            const st = p.missions[m.id];
            const on = m.id === mission.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMission(m.id)}
                disabled={!m.ready}
                className={[
                  "flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left last:border-b-0",
                  on ? "bg-sunken" : "",
                  m.ready ? "hover:bg-sunken" : "cursor-default opacity-55",
                ].join(" ")}
              >
                <span className="mt-0.5 w-4 shrink-0 text-[11px] font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-ink">{m.title}</span>
                  <span className="block truncate text-[11px] text-muted">{m.where}</span>
                </span>
                <span className="mt-0.5 shrink-0 text-[10.5px] font-bold">
                  {!m.ready ? (
                    <span className="text-muted">준비 중</span>
                  ) : st?.done ? (
                    <span className="text-success-text">완료</span>
                  ) : st ? (
                    <span className="text-ink-soft">진행 중</span>
                  ) : (
                    <span className="text-muted">시작 전</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-3 rounded border border-line bg-surface p-3">
          <div className="text-[11px] font-bold text-muted">연습 회사</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
            (주)새봄테크 — 여기서 한 일은 실제 회사 데이터에 영향을 주지 않습니다.
          </p>
          <button
            type="button"
            onClick={() => openCore("/dashboard")}
            disabled={gateBusy}
            className="mt-2 w-full rounded border border-line-strong px-3 py-2 text-[11.5px] font-bold text-ink hover:bg-sunken disabled:opacity-55"
          >
            연습 회사 열기
          </button>
          <button
            type="button"
            onClick={resetCompany}
            disabled={gateBusy}
            className="mt-1.5 w-full rounded border border-line px-3 py-2 text-[11.5px] font-bold text-ink-soft hover:bg-sunken disabled:opacity-55"
          >
            연습 데이터 처음으로
          </button>
          {note ? (
            <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{note}</p>
          ) : null}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setLink(null);
                setNote(null);
              }}
              className="mt-1.5 block rounded border border-line-strong px-3 py-2 text-center text-[11.5px] font-bold text-ink hover:bg-sunken"
            >
              연습 회사 열기 (새 창)
            </a>
          ) : null}
        </div>

        <div className="mt-3 rounded border border-line bg-surface p-3">
          <div className="text-[11px] font-bold text-muted">도움 단계</div>
          <div className="mt-2 flex gap-1">
            {HELP.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => put({ ...p, help: h.id })}
                className={[
                  "flex-1 rounded border px-1.5 py-1.5 text-[11px] font-bold",
                  p.help === h.id
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink-soft hover:bg-sunken",
                ].join(" ")}
              >
                {h.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {HELP.find((h) => h.id === p.help)?.hint}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearProgress(course.id, owner);
            put(emptyProgress(course.id, first));
            setWhy(null);
            setRes(null);
          }}
          className="mt-3 w-full rounded border border-line px-3 py-2 text-[11.5px] font-bold text-ink-soft hover:bg-sunken"
        >
          처음부터 다시
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col rounded border border-line bg-surface">
        <header className="shrink-0 border-b border-line px-4 py-3 md:px-5">
          <div className="text-[11px] font-bold text-muted">{mission.where}</div>
          <h2 className="mt-0.5 text-[14.5px] font-bold text-ink">{mission.title}</h2>
          <p className="mt-0.5 text-[12px] text-ink-soft">{mission.goal}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {played.map((s, i) => (
            <Played key={i} s={s} pick={mp.picks?.[String(i)]} name={name} role={role} />
          ))}

          {cur?.k === "ask" ? <Bubble who={name(cur.who)} role={role(cur.who)} t={cur.q} /> : null}
          {cur?.k === "do" ? <Bubble who={name(cur.who)} role={role(cur.who)} t={cur.t} /> : null}

          {why ? (
            <div
              className={[
                "mt-3 rounded border px-3 py-2.5 text-[12.5px] leading-relaxed",
                why.ok
                  ? "border-success-border bg-success-soft text-success-text"
                  : "border-warning-border bg-warning-soft text-warning-text",
              ].join(" ")}
            >
              <div className="mb-0.5 text-[11px] font-bold">
                {why.ok ? "맞습니다" : "다시 보겠습니다"}
              </div>
              {why.t}
            </div>
          ) : null}

          {doneMission ? (
            <div className="mt-4 rounded border border-line bg-sunken px-3 py-3">
              <div className="text-[12.5px] font-bold text-ink">미션 완료</div>
              <p className="mt-1 text-[12px] text-ink-soft">
                {mp.wrongs
                  ? `판단 체크에서 ${mp.wrongs}번 다시 골랐습니다.`
                  : "판단 체크를 한 번에 통과했습니다."}
              </p>
              <NextMission course={course} curId={mission.id} go={setMission} />
            </div>
          ) : null}
        </div>

        {cur?.k === "ask" && !doneMission ? (
          <div className="shrink-0 border-t border-line p-3 md:p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {cur.a.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(i)}
                  className="rounded border border-line-strong px-3 py-2.5 text-left text-[12.5px] font-bold leading-relaxed text-ink hover:bg-sunken"
                >
                  {a.t}
                </button>
              ))}
            </div>
            {why?.ok ? (
              <button
                type="button"
                onClick={advance}
                className="mt-2 w-full rounded bg-primary px-3 py-2.5 text-[12.5px] font-bold text-white hover:bg-primary-hover"
              >
                다음
              </button>
            ) : null}
          </div>
        ) : null}

        {cur?.k === "do" && !doneMission ? (
          <div className="shrink-0 border-t border-line p-3 md:p-4">
            {cur.open ? (
              <button
                type="button"
                onClick={() => openCore(cur.open)}
                disabled={gateBusy}
                className="block w-full rounded border border-line-strong px-3 py-2.5 text-center text-[12.5px] font-bold text-ink hover:bg-sunken disabled:opacity-55"
              >
                {cur.openLabel ?? "화면 열기"}
              </button>
            ) : null}

            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  setLink(null);
                  setNote(null);
                }}
                className="mt-2 block rounded border border-line-strong px-3 py-2 text-center text-[12px] font-bold text-ink hover:bg-sunken"
              >
                새 창이 막혔습니다 — 여기를 눌러 여세요
              </a>
            ) : null}

            {p.help === "follow" || openSteps ? (
              <ol className="mt-2 list-decimal space-y-1 rounded border border-line bg-sunken py-2 pl-7 pr-3 text-[12px] leading-relaxed text-ink-soft">
                {cur.steps.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            ) : p.help === "hint" ? (
              <div className="mt-2 rounded border border-line bg-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
                {cur.hint}
                <button
                  type="button"
                  onClick={() => setOpenSteps(true)}
                  className="mt-1.5 block text-[11.5px] font-bold text-accent hover:underline"
                >
                  순서 보기
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenSteps(true)}
                className="mt-2 block text-[11.5px] font-bold text-muted hover:underline"
              >
                막혔습니다 — 순서 보기
              </button>
            )}

            {res ? (
              <div
                className={[
                  "mt-2 rounded border px-3 py-2.5 text-[12.5px] leading-relaxed",
                  res.state === "ok"
                    ? "border-success-border bg-success-soft text-success-text"
                    : res.state === "wrong"
                      ? "border-urgent-border bg-urgent-soft text-urgent"
                      : "border-warning-border bg-warning-soft text-warning-text",
                ].join(" ")}
              >
                <div className="mb-0.5 text-[11px] font-bold">
                  {res.state === "ok"
                    ? "확인했습니다"
                    : res.state === "wrong"
                      ? `아직입니다 — ${res.field ?? "확인 필요"}`
                      : res.state === "todo"
                        ? "아직 못 찾았습니다"
                        : "연결되지 않았습니다"}
                </div>
                {/* 확인 시험 단계에서는 무엇이 어긋났는지만 알려 주고 답은 말하지 않는다. */}
                {p.help === "test" && res.state === "wrong" ? "직접 다시 보세요." : res.msg}
              </div>
            ) : null}

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={check}
                disabled={busy}
                className="flex-1 rounded bg-primary px-3 py-2.5 text-[12.5px] font-bold text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {busy ? "확인하는 중" : "다 했습니다 — 확인"}
              </button>
              {res?.state === "ok" ? (
                <button
                  type="button"
                  onClick={advance}
                  className="flex-1 rounded border border-line-strong px-3 py-2.5 text-[12.5px] font-bold text-ink hover:bg-sunken"
                >
                  다음
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function NextMission({
  course,
  curId,
  go,
}: {
  course: Course;
  curId: string;
  go: (id: string) => void;
}) {
  const i = course.missions.findIndex((m) => m.id === curId);
  const next = course.missions[i + 1];
  if (!next) return null;
  if (!next.ready)
    return (
      <p className="mt-2 text-[12px] text-muted">
        다음 미션 &lsquo;{next.title}&rsquo;{josa(next.title, "은")} 아직 준비 중입니다.
      </p>
    );
  return (
    <button
      type="button"
      onClick={() => go(next.id)}
      className="mt-2 rounded bg-primary px-3 py-2 text-[12px] font-bold text-white hover:bg-primary-hover"
    >
      다음 미션 — {next.title}
    </button>
  );
}

function Played({
  s,
  pick,
  name,
  role,
}: {
  s: Scene;
  pick?: number;
  name: (w: string) => string;
  role: (w: string) => string;
}) {
  if (s.k === "note")
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-sunken px-3 py-1 text-[10.5px] font-bold text-muted">
          {s.t}
        </span>
      </div>
    );
  if (s.k === "say") return <Bubble who={name(s.who)} role={role(s.who)} t={s.t} />;
  if (s.k === "me") return <Bubble mine t={s.t} />;
  if (s.k === "ask") {
    const a = pick === undefined ? undefined : s.a[pick];
    return (
      <>
        <Bubble who={name(s.who)} role={role(s.who)} t={s.q} />
        {a ? <Bubble mine t={a.t} /> : null}
        {a ? <Bubble who={name(s.who)} role={role(s.who)} t={a.why} /> : null}
      </>
    );
  }
  return (
    <>
      <Bubble who={name(s.who)} role={role(s.who)} t={s.t} />
      <div className="mt-2 rounded border border-line bg-sunken px-3 py-2 text-[12px] font-bold text-success-text">
        화면에서 처리하고 확인까지 끝냈습니다.
      </div>
    </>
  );
}

function Bubble({
  who,
  role,
  t,
  mine = false,
}: {
  who?: string;
  role?: string;
  t: string;
  mine?: boolean;
}) {
  return (
    <div className={["mt-3 flex", mine ? "justify-end" : "justify-start"].join(" ")}>
      <div className="max-w-[min(34rem,88%)]">
        {!mine && who ? (
          <div className="mb-1 text-[11px] font-bold text-muted">
            {who}
            {role ? ` · ${role}` : ""}
          </div>
        ) : null}
        <div
          className={[
            "rounded-lg px-3 py-2 text-[12.5px] leading-relaxed",
            mine ? "bg-primary text-white" : "border border-line bg-sunken text-ink",
          ].join(" ")}
        >
          {t}
        </div>
      </div>
    </div>
  );
}
