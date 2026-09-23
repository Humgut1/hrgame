import { redirect } from "next/navigation";

/** Grow 첫 화면 = 직무 교육. 예전 시뮬레이터는 /sim 에 남아 있다. */
export default function HomePage() {
  redirect("/train");
}
