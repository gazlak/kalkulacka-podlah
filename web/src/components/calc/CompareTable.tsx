"use client";

import { comparePatterns, formatCZK } from "@/lib/calc";
import { Icon } from "@/components/ui/Icon";
import { pricingOf } from "@/lib/quote";
import { patternImg } from "@/lib/textures";
import type { Calculation, Pricing } from "@/lib/types";

/** Porovnání 6 vzorů: seznam na mobilu, tabulka na desktopu. */
export function CompareTable({
  calc: c, current, readOnly, onUse,
}: { calc: Calculation; current: Pricing; readOnly: boolean; onUse: (patternId: number) => void }) {
  const cmp = comparePatterns(c.groups, pricingOf(c, current), c.discount, c.vatRate, c.extras);
  const min = Math.min(...cmp.map((x) => x.quote.total));

  const use = (id: number) => {
    if (c.patternId === id)
      return <span className="badge st-přijato"><Icon name="check" size="sm" />Vybraný vzor</span>;
    return readOnly ? null : <button className="btn sm tonal" onClick={() => onUse(id)}>Použít</button>;
  };

  return (
    <>
      <div className="list only-mobile">
        {cmp.map((x) => {
          const best = x.quote.total === min;
          return (
            <div key={x.pattern.id} className={`cmp-row${best ? " best" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={patternImg(x.pattern)} alt="" />
              <div className="nm">
                <b>{x.pattern.name}</b>
                <span className="small muted">{formatCZK(x.pattern.materialPerM2)}/m² · prořez {x.pattern.wastePct}&nbsp;%</span>
              </div>
              <div className="pr">
                <b>{formatCZK(x.quote.total)}</b>
                <small>{best ? <span className="badge st-přijato">Nejlevnější</span> : `+ ${formatCZK(x.quote.total - min)}`}</small>
              </div>
              <div className="use">{use(x.pattern.id)}</div>
            </div>
          );
        })}
      </div>
      <div className="card only-desktop" style={{ overflow: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Vzor</th><th className="num">Materiál</th><th className="num">Práce</th><th className="num">Podstupnice</th>
              <th className="num">Doprava</th><th className="num">Bez DPH</th><th className="num">S DPH</th><th className="num">Rozdíl</th><th />
            </tr>
          </thead>
          <tbody>
            {cmp.map(({ pattern: p, quote: q }) => (
              <tr key={p.id} className={q.total === min ? "best" : ""}>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb" src={patternImg(p)} alt="" />
                  <b>{p.name}</b>{q.total === min && <> <span className="badge st-přijato">Nejlevnější</span></>}
                </td>
                <td className="num">{formatCZK(q.material)}</td>
                <td className="num">{formatCZK(q.labor)}</td>
                <td className="num">{formatCZK(q.risers)}</td>
                <td className="num">{formatCZK(q.transport)}</td>
                <td className="num">{formatCZK(q.base)}</td>
                <td className="num"><b>{formatCZK(q.total)}</b></td>
                <td className="num">{q.total === min ? "—" : `+ ${formatCZK(q.total - min)}`}</td>
                <td>{use(p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
