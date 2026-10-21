import { formatCZK, formatM2, formatPct } from "@/lib/calc";
import { fmtDate } from "@/lib/format";
import { patternImg } from "@/lib/textures";
import type { Calculation, Pattern, Profile, Quote, Rates } from "@/lib/types";

function PdfRow({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <tr>
      <td>{k}</td>
      <td className="num">{bold ? <b>{v}</b> : v}</td>
    </tr>
  );
}

/** Tisková A4 stránka kalkulace. Stejnou komponentu renderuje server do PDF (src/server/pdf.tsx). */
export function PdfSheet({
  calc: c, pattern: pat, quote: q, rates: r, owner,
}: { calc: Calculation; pattern: Pattern; quote: Quote; rates: Rates; owner: Profile }) {
  return (
    <div className="pdf-wrap">
      <div className="pdf-sheet">
        <div className="pdf-top">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {owner.logo && <><img className="logo" src={owner.logo} alt="Logo" /><br /></>}
            <b>{owner.company || owner.name}</b><br />
            <span className="small">
              {[owner.name, owner.ico ? `IČO ${owner.ico}` : "", owner.phone].filter(Boolean).map((t, i) => (
                <span key={i}>{i > 0 && <br />}{t}</span>
              ))}
            </span>
          </div>
          <div className="right">
            <h1>Kalkulace č. {c.number}</h1>
            <div>Datum: {fmtDate(c.createdAt)}</div>
          </div>
        </div>
        <hr />
        <dl className="pdf-meta">
          <dt>Zakázka</dt><dd>{c.job.name}</dd>
          <dt>Zákazník</dt><dd>{c.job.customer || "—"}</dd>
          {c.job.address && <><dt>Adresa</dt><dd>{c.job.address}</dd></>}
        </dl>
        <div className="pat-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={patternImg(pat)} alt="" />
          <div>
            <b>{pat.name}</b><br />
            <span className="small">{formatCZK(pat.materialPerM2)} / m², prořez {pat.wastePct} %</span>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Šířka</th><th>Hloubka</th><th>Podstupnice</th><th className="num">Počet</th><th className="num">Plocha</th></tr>
          </thead>
          <tbody>
            {c.groups.map((g, i) => (
              <tr key={i}>
                <td>{g.width} cm</td><td>{g.depth} cm</td>
                <td>{g.coverRiser ? `${g.riserHeight} cm` : "bez obkladu"}</td>
                <td className="num">{g.count} ks</td><td className="num">{formatM2(q.areas[i])}</td>
              </tr>
            ))}
            <tr><td colSpan={4}><b>Celkem</b></td><td className="num"><b>{formatM2(q.totalArea)}</b></td></tr>
          </tbody>
        </table>
        <table className="tbl">
          <tbody>
            <PdfRow k="Materiál vč. prořezu" v={formatCZK(q.material)} />
            <PdfRow k="Práce" v={formatCZK(q.labor)} />
            <PdfRow k="Obklad podstupnic" v={formatCZK(q.risers)} />
            <PdfRow k="Doprava" v={formatCZK(q.transport)} />
            {r.extrasEnabled && q.extras > 0 && <PdfRow k="Volitelné příplatky" v={formatCZK(q.extras)} />}
            {q.discountAmount > 0 && <PdfRow k="Sleva" v={`− ${formatCZK(q.discountAmount)}`} />}
            <PdfRow k="Cena bez DPH" v={formatCZK(q.base)} bold />
            <PdfRow k={`DPH ${formatPct(c.vatRate)}`} v={formatCZK(q.vat)} />
          </tbody>
        </table>
        <div className="pdf-total">
          <span><b>Celkem s DPH</b></span>
          <span className="v">{formatCZK(q.total)}</span>
        </div>
        <div className="pdf-foot">
          Cena platí dle ceníku k {fmtDate(c.createdAt)}.
        </div>
      </div>
    </div>
  );
}
