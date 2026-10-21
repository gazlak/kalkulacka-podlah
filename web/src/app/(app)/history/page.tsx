"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/chrome/TopBar";
import { Icon } from "@/components/ui/Icon";
import { Sheet, SheetList } from "@/components/ui/Sheet";
import { Empty, statusLabel } from "@/components/ui/misc";
import { formatCZK } from "@/lib/calc";
import { fmtDate } from "@/lib/format";
import { useCalcs, usePricing, useSession } from "@/lib/hooks";
import { quoteOf } from "@/lib/quote";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CalcStatus, Calculation } from "@/lib/types";

const SORTS = [
  ["date-desc", "Datum – nejnovější"], ["date-asc", "Datum – nejstarší"],
  ["price-desc", "Cena – nejvyšší"], ["price-asc", "Cena – nejnižší"],
  ["name-asc", "Zakázka A–Z"], ["name-desc", "Zakázka Z–A"],
] as const;
const STATUSES: [CalcStatus | "", string][] = [
  ["", "Vše"], ["koncept", "Koncept"], ["odesláno", "Odesláno"], ["přijato", "Přijato"], ["zamítnuto", "Zamítnuto"],
];

export default function HistoryPage() {
  const { data: user } = useSession();
  const calcs = useCalcs();
  const pricing = usePricing();
  const ownerIds = useMemo(() => [...new Set(calcs.data?.map((c) => c.ownerId))].sort(), [calcs.data]);
  const users = useQuery({
    queryKey: ["owners", ownerIds],
    enabled: !!calcs.data,
    queryFn: async () => {
      const owners = await Promise.all(ownerIds.map((id) => api.users.lookup(id)));
      return Object.fromEntries(owners.filter(Boolean).map((o) => [o!.id, o!.profile.company || o!.profile.name || o!.email]));
    },
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CalcStatus | "">("");
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("date-desc");
  const [sortOpen, setSortOpen] = useState(false);

  const items = useMemo(() => {
    if (!calcs.data || !pricing.data) return null;
    const ql = q.trim().toLowerCase();
    const owner = (c: Calculation) => users.data?.[c.ownerId] ?? "";
    const rows = calcs.data
      .map((c) => ({ c, total: c.patternId ? quoteOf(c, pricing.data).total : null }))
      .filter((x) => {
        if (status && x.c.status !== status) return false;
        if (!ql) return true;
        return [x.c.job.name, x.c.job.customer, x.c.number ?? "", owner(x.c)].join(" ").toLowerCase().includes(ql);
      });
    const [key, d] = sort.split("-");
    const dir = d === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const r = key === "date" ? a.c.updatedAt - b.c.updatedAt
        : key === "price" ? (a.total ?? 0) - (b.total ?? 0)
        : (a.c.job.name || "").localeCompare(b.c.job.name || "", "cs");
      return r * dir;
    });
    return rows;
  }, [calcs.data, pricing.data, users.data, q, status, sort]);

  if (!user) return null;
  const admin = user.role === "admin";

  return (
    <>
      <TopBar />
      <h1 className="large-title">{admin ? "Všechny kalkulace" : "Kalkulace"}</h1>
      <div className="row mb" style={{ flexWrap: "nowrap" }}>
        <div className="search">
          <Icon name="search" />
          <input type="search" placeholder={`Hledat zakázku, zákazníka, číslo${admin ? ", podlahář" : ""}`} value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Hledat" />
        </div>
        <button type="button" className="btn sq" onClick={() => setSortOpen(true)} aria-label="Řazení">
          <Icon name="sort" />
        </button>
      </div>
      <div className="chips" role="group" aria-label="Stav">
        {STATUSES.map(([v, label]) => (
          <button key={v} type="button" className={`chip${status === v ? " on" : ""}`} aria-pressed={status === v} onClick={() => setStatus(v)}>
            {label}
          </button>
        ))}
      </div>
      <div id="hlist">
        {items?.map(({ c, total }) => {
          const foreign = c.ownerId !== user.id;
          const href = c.number || foreign ? `/calc/${c.id}` : `/wizard/${c.id}/1`;
          return (
            <Link key={c.id} className="hist-card" href={href}>
              <div className="top">
                <div>
                  <div className="name">{c.job.name || "Bez názvu"}</div>
                  <div className="small muted">{c.job.customer || "bez zákazníka"} · {fmtDate(c.updatedAt)}</div>
                </div>
                <div className="price">{total === null ? "—" : formatCZK(total)}</div>
              </div>
              {admin && foreign && (
                <div className="who"><Icon name="user" size="sm" />{users.data?.[c.ownerId]}</div>
              )}
              <div className="foot">
                <span className={`dot st-${c.status}`}>{statusLabel(c.status)}</span>
                <span>{c.number ? `č. ${c.number}` : "rozpracováno"}</span>
              </div>
            </Link>
          );
        })}
        {items && items.length === 0 && (
          <Empty>
            {calcs.data?.length ? (
              <p>Nic nenalezeno.<br />Zkuste upravit hledání nebo filtr.</p>
            ) : (
              <>
                <p>Zatím nemáte žádnou kalkulaci.</p>
                <Link className="btn primary" href="/new"><Icon name="plus" />Vytvořit první kalkulaci</Link>
              </>
            )}
          </Empty>
        )}
      </div>
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)}>
        <h2>Řazení</h2>
        <SheetList>
          {SORTS.map(([v, label]) => (
            <button key={v} type="button" className="lrow" onClick={() => { setSort(v); setSortOpen(false); }}>
              <span>{label}</span>{sort === v && <Icon name="check" />}
            </button>
          ))}
        </SheetList>
      </Sheet>
    </>
  );
}
