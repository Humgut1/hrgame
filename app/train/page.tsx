import { TrainLogin, TrainNoCourse, TrainOffline } from "@/components/train/TrainGate";
import { TrainShell } from "@/components/train/TrainShell";
import { fetchLearner } from "@/lib/auth/core";
import { currentSession, loginOn } from "@/lib/auth/guard";
import { ACTIVE_COURSE_ID, courseFor, loadCourse, toClientCourse } from "@/lib/train/course";
import type { Progress } from "@/lib/train/progress";

export const metadata = { title: "직무 교육 — Grow" };
export const dynamic = "force-dynamic";

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const { login } = await searchParams;

  // TalentCore 연결이 없는 로컬 개발 — 예전처럼 로그인 없이 기본 과정.
  if (!loginOn()) {
    if (login === "off") return <TrainLogin why="off" />;
    return <TrainShell course={toClientCourse(loadCourse(ACTIVE_COURSE_ID))} />;
  }

  const s = await currentSession();
  if (!s) return <TrainLogin why={login} />;

  // 사람 정보는 매번 TalentCore 에서 — 부서·직급·세부 직무가 바뀌면 바로 따라간다.
  const r = await fetchLearner(s.u);
  if (!r.ok) return r.why === "gone" ? <TrainLogin why="gone" /> : <TrainOffline />;
  const l = r.learner;

  const course = courseFor(l.job_profile?.code);
  if (!course) return <TrainNoCourse name={l.name} dept={l.dept} profile={l.job_profile?.name} />;

  const rec = r.records.find((x) => x.course_id === course.id);
  return (
    <TrainShell
      course={toClientCourse(course)}
      learner={{ id: l.id, name: l.name, dept: l.dept, position: l.position, profile: l.job_profile }}
      saved={{
        state: (rec?.state as unknown as Progress) ?? null,
        completedAt: rec?.completed_at ?? null,
      }}
    />
  );
}
