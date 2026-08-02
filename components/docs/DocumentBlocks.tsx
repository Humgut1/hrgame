import { resolveCompanyTable } from "@/lib/data";
import type { Company, DocBlock } from "@/types/scenario";

function Heading({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <h2 className="mb-2 text-sm font-bold text-ink">{children}</h2>;
}

function DataTable({
  columns,
  rows,
  numericColumns = [],
}: {
  columns: string[];
  rows: string[][];
  numericColumns?: number[];
}) {
  const numeric = new Set(numericColumns);

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-md border-collapse text-sm">
        <thead>
          <tr className="bg-sunken">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={[
                  "border-b border-line px-3.5 py-2.5 text-[11px] font-extrabold text-ink-soft",
                  numeric.has(i) ? "text-right" : "text-left",
                ].join(" ")}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-b-0">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={[
                    "px-3.5 py-2.5 text-ink",
                    numeric.has(c) ? "text-right font-mono tabular-nums" : "text-left",
                  ].join(" ")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, company }: { block: DocBlock; company: Company }) {
  switch (block.type) {
    case "text":
      return (
        <section>
          <Heading>{block.heading}</Heading>
          <p className="text-sm leading-relaxed text-ink-soft">{block.text}</p>
        </section>
      );

    case "fields":
      return (
        <section>
          <Heading>{block.heading}</Heading>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {block.items.map((item, i) => (
              <div key={i} className="flex gap-4 px-3.5 py-3">
                <dt className="w-28 shrink-0 text-xs font-semibold text-muted">{item.label}</dt>
                <dd
                  className={[
                    "min-w-0 flex-1 text-sm",
                    item.emphasis ? "font-semibold text-ink" : "text-ink-soft",
                  ].join(" ")}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      );

    case "table":
      return (
        <section>
          <Heading>{block.heading}</Heading>
          <DataTable columns={block.columns} rows={block.rows} />
        </section>
      );

    case "companyTable": {
      const resolved = resolveCompanyTable(company, block);
      return (
        <section>
          <Heading>{block.heading}</Heading>
          <DataTable
            columns={resolved.columns}
            rows={resolved.rows}
            numericColumns={resolved.numericColumns}
          />
        </section>
      );
    }

    case "note":
      return (
        <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-xs leading-relaxed text-ink-soft">
          {block.text}
        </p>
      );
  }
}

export function DocumentBlocks({
  blocks,
  company,
}: {
  blocks: DocBlock[];
  company: Company;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <Block key={i} block={block} company={company} />
      ))}
    </div>
  );
}
