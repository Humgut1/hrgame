import { DocsList } from "@/components/docs/DocsList";
import { ACTIVE_SCENARIO_ID, loadStage } from "@/lib/data";

export default function DocsIndexPage() {
  const { scenario } = loadStage(ACTIVE_SCENARIO_ID);
  const docs = scenario.documents.map(({ id, kind, title, issuedAt, summary }) => ({
    id,
    kind,
    title,
    issuedAt,
    summary,
  }));

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-accent uppercase">자료실</p>
      <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-ink">채용 자료실</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        열람에는 시간이 소모되지 않습니다. 다만 무엇을 읽었는지는 기록되고, 평가에 반영됩니다.
      </p>

      <DocsList docs={docs} />
    </div>
  );
}
