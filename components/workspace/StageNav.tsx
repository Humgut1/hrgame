"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/game/SessionProvider";

export interface NavItem {
  href: string;
  label: string;
  hint?: string;
  /** 이 국면에서 아직 열 수 없는 화면 */
  locked?: boolean;
  lockReason?: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/workspace") return pathname === "/workspace";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StageNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { scenario, state } = useSession();

  return (
    <nav aria-label="워크스페이스" className="px-2.5 pb-2 pt-3.5">
      <div className="mb-1.5 px-2 text-[10px] font-extrabold tracking-[0.14em] text-muted">
        업무
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const docBadge =
            item.href === "/workspace/docs"
              ? `${state.readDocIds.length}/${scenario.documentIds.length}`
              : undefined;

          if (item.locked) {
            return (
              <li key={item.href}>
                <div
                  className="cursor-not-allowed rounded-lg px-3 py-2.5 opacity-50"
                  title={item.lockReason}
                >
                  <div className="text-sm font-semibold text-ink">{item.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{item.lockReason ?? item.hint}</div>
                </div>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-sunken",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div
                    className={[
                      "text-sm font-semibold",
                      active ? "text-accent" : "text-ink",
                    ].join(" ")}
                  >
                    {item.label}
                  </div>
                  {item.hint ? (
                    <div className="mt-0.5 truncate text-xs text-muted">{item.hint}</div>
                  ) : null}
                </div>
                {docBadge ? (
                  <span className="shrink-0 font-mono text-[10px] text-muted">{docBadge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
