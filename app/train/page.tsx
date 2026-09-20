import { TrainShell } from "@/components/train/TrainShell";
import { ACTIVE_COURSE_ID, loadCourse, toClientCourse } from "@/lib/train/course";

export const metadata = { title: "교육 — 채용 한 건, 끝까지" };

export default function TrainPage() {
  // 검사 조건은 떼고 보낸다. 주소만 넘겨 진짜 화면으로 이어 준다.
  const course = toClientCourse(loadCourse(ACTIVE_COURSE_ID));
  const coreUrl = (process.env.TRAIN_CORE_URL || "").replace(/\/$/, "");
  return <TrainShell course={course} coreUrl={coreUrl} />;
}
