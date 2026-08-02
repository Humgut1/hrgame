"use client";

import Link from "next/link";

import { useSession } from "@/lib/game/SessionProvider";

export interface DocSummary {
  id: string;
  kind: string;
  title: string;
  issuedAt?: string;
  summary?: string;
}

export function DocsList({ docs }: { docs: DocSummary[] }) {
  const { state } = useSession();
  const readCount = docs.filter((doc) => state.readDocIds.includes(doc.id)).length;

  return (
    <>
      <p className="mt-4 font-mono text-xs font-semibold text-muted">
        {readCount} / {docs.length} 열람함
      </p>

      <ul className="mt-3 space-y-2">
        {docs.map((doc) => {
          const read = state.readDocIds.includes(doc.id);
          return (
            <li key={doc.id}>
              <Link
                href={`/workspace/docs/${doc.id}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-sunken"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="rounded-md bg-sunken px-1.5 py-0.5 font-semibold">
                      {doc.kind}
                    </span>
                    {doc.issuedAt ? <span className="font-mono">{doc.issuedAt}</span> : null}
                  </div>
                  <span
                    className={[
                      "rounded px-1.5 py-0.5 text-[10px] font-bold",
                      read ? "bg-success-soft text-success-text" : "bg-sunken text-muted",
                    ].join(" ")}
                  >
                    {read ? "열람함" : "읽지 않음"}
                  </span>
                </div>
                <h2 className="mt-1.5 text-sm font-bold text-ink">{doc.title}</h2>
                {doc.summary ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{doc.summary}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
