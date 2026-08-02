import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentBlocks } from "@/components/docs/DocumentBlocks";
import { MarkDocRead } from "@/components/docs/MarkDocRead";
import { ACTIVE_SCENARIO_ID, findDocument, loadStage } from "@/lib/data";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const { scenario, company } = loadStage(ACTIVE_SCENARIO_ID);

  const doc = findDocument(scenario, docId);
  if (!doc) notFound();

  const index = scenario.documents.findIndex((d) => d.id === doc.id);
  const next = scenario.documents[index + 1];

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <MarkDocRead docId={doc.id} />

      <Link href="/workspace/docs" className="text-xs text-muted hover:text-accent">
        ← 자료실
      </Link>

      <header className="mt-3 border-b border-line pb-5">
        <div className="text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">
          {doc.kind}
          {doc.issuedAt ? ` · ${doc.issuedAt}` : ""}
        </div>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-ink">{doc.title}</h1>
      </header>

      <div className="mt-7">
        <DocumentBlocks blocks={doc.blocks} company={company} />
      </div>

      {next ? (
        <div className="mt-10 border-t border-line pt-5">
          <Link
            href={`/workspace/docs/${next.id}`}
            className="group block rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-sunken"
          >
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-muted uppercase">
              다음 문서
            </div>
            <div className="mt-1 text-sm font-bold text-ink group-hover:text-accent">
              {next.title}
            </div>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
