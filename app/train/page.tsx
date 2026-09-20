import { TrainShell } from "@/components/train/TrainShell";
import { ACTIVE_COURSE_ID, loadCourse, toClientCourse } from "@/lib/train/course";

export const metadata = { title: "교육 — 채용 한 건, 끝까지" };

export default function TrainPage() {
  // 검사 조건은 떼고 보낸다. 연습 회사 주소·열쇠도 서버에만 둔다(입장은 표로).
  const course = toClientCourse(loadCourse(ACTIVE_COURSE_ID));
  return <TrainShell course={course} />;
}
