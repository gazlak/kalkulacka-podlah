"use client";

import Link from "next/link";
import { formatCZK, formatM2 } from "@/lib/calc";
import { Icon } from "@/components/ui/Icon";
import { Alert, Row, StatusBadge, statusLabel } from "@/components/ui/misc";
import { Seg } from "@/components/ui/Seg";
import { fmtDate } from "@/lib/format";
import { useOwner } from "@/lib/hooks";
import { discountError, patternOf, priceChanged, pricingOf, quoteOf } from "@/lib/quote";
import { patternImg } from "@/lib/textures";
import type { CalcActions } from "@/lib/useCalcActions";
import type { CalcDraft } from "@/lib/useCalcDraft";
import type { CalcStatus, Pricing } from "@/lib/types";
import { DiscountVatCard } from "./DiscountVatCard";
import { ExtrasCard } from "./ExtrasCard";
import { HeroPrice } from "./HeroPrice";
import { PriceBreakdown } from "./PriceBreakdown";

export function PriceNotice({ draft, current, onRecalc }: { draft: CalcDraft; current: Pricing; onRecalc: () => void }) {
  const c = draft.calc!;
  if (!priceChanged(c, current)) return null;
  return (
    <Alert kind="warn">
      <b>Ceník se od uložení kalkulace změnil.</b> Kalkulace stále počítá s cenami z {fmtDate(c.createdAt)} (číslo {c.number}).
      {!draft.readOnly && (
        <div><button className="btn sm" onClick={onRecalc}>Přepočítat podle aktuálního ceníku</button></div>
      )}
    </Alert>
  );
}

/** Obsah obrazovky kalkulace (krok 4 průvodce i detail). */
export function CalcView({
  draft, act, current, inWizard,
}: { draft: CalcDraft; act: CalcActions; current: Pricing; inWizard: boolean }) {
  const { calc: c, readOnly, update } = draft;
  const owner = useOwner(c?.ownerId).data?.profile;
  if (!c) return null;
  const pr = pricingOf(c, current);
  const pat = patternOf(c, current);
  if (!pat) return null;
  const q = quoteOf(c, current);
  const dErr = discountError(c, pr);

  return (
    <>
      {!inWizard && <PriceNotice draft={draft} current={current} onRecalc={act.recalc} />}
      {!c.number && (
        <Alert kind="info">Kalkulace zatím není uložena. Číslo bude přiděleno při uložení a ceník se „zamkne“.</Alert>
      )}
      <div className="card hero calc-head">
        <div className="row between">
          <span className="eyebrow">Celkem s DPH</span>
          <StatusBadge status={c.status} />
        </div>
        <div id="heroPrice"><HeroPrice quote={q} vatRate={c.vatRate} rates={pr.rates} /></div>
        <Link className="pat" href={`/compare/${c.id}`} aria-label="Porovnat vzory">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={patternImg(pat)} alt="" />
          <span className="grow">
            <b>{pat.name}</b>
            <span className="small">{formatM2(q.totalArea)} · {formatCZK(pat.materialPerM2)} / m²</span>
          </span>
          <span className="small cmp-link"><span className="lbl-t">Porovnat</span><Icon name="chev-r" size="sm" /></span>
        </Link>
        <div className="meta">
          <span>{c.number ? <>č. <b style={{ color: "var(--text)" }}>{c.number}</b></> : "číslo bude přiděleno při uložení"}</span>
          <span>{fmtDate(c.createdAt)}</span>
        </div>
      </div>

      {readOnly ? (
        <>
          <Alert kind="info" className="no-print">Kalkulace podlaháře – jen ke čtení.</Alert>
          <div className="btn-grid mb no-print">
            <button className="btn" onClick={act.pdf}><Icon name="pdf" />PDF</button>
            <button className="btn" onClick={act.duplicate}><Icon name="copy" />Duplikovat</button>
          </div>
        </>
      ) : (
        <div className="btn-grid mb no-print">
          <button className="btn" onClick={act.pdf}><Icon name="pdf" />PDF</button>
          <button className="btn" onClick={act.openMail}><Icon name="mail" />Odeslat</button>
          {!inWizard && (
            <>
              <Link className="btn" href={`/wizard/${c.id}/1`}><Icon name="edit" />Upravit</Link>
              <button className="btn" onClick={act.duplicate}><Icon name="copy" />Duplikovat</button>
            </>
          )}
        </div>
      )}

      {c.number && !readOnly && (
        <>
          <div className="section-title">Stav kalkulace</div>
          <div className="card">
            <Seg<CalcStatus> full label="Stav" value={c.status} onChange={act.setStatus}
              options={(["přijato", "zamítnuto"] as const).map((s) => ({ value: s, label: statusLabel(s) }))} />
            {(c.status === "přijato" || c.status === "zamítnuto") && (
              <button className="btn sm ghost mt-2" onClick={() => act.setStatus(c.sentTo ? "odesláno" : "koncept")}>
                Zrušit označení
              </button>
            )}
          </div>
        </>
      )}

      <div className="section-title">Rozpis ceny</div>
      <PriceBreakdown quote={q} pattern={pat} rates={pr.rates} discount={c.discount} vatRate={c.vatRate} />

      <div className="section-title">Schody</div>
      <div className="list">
        {c.groups.map((g, i) => (
          <Row key={i} k={`${g.width} × ${g.depth} cm`}
            sub={`${g.count} ks · ${g.coverRiser ? `podstupnice ${g.riserHeight} cm` : "bez podstupnice"}`}
            v={formatM2(q.areas[i])} />
        ))}
        <Row k="Celková plocha" v={formatM2(q.totalArea)} cls="tot" />
      </div>

      <div className="section-title">Sleva a DPH</div>
      <DiscountVatCard discount={c.discount} vatRate={c.vatRate} rates={pr.rates} error={dErr} readOnly={readOnly}
        onDiscount={(d) => update((x) => ({ ...x, discount: d }))}
        onVat={(v) => update((x) => ({ ...x, vatRate: v }))} />

      <ExtrasCard rates={pr.rates} values={c.extras ?? {}} readOnly={readOnly}
        onChange={(k, v) => update((x) => ({ ...x, extras: { ...x.extras, [k]: v } }))} />

      <div className="section-title">Zakázka</div>
      <div className="list">
        <Row k="Zakázka" v={<span style={{ fontWeight: 600, whiteSpace: "normal" }}>{c.job.name}</span>} />
        <Row k="Zákazník" v={c.job.customer || "—"} />
        {c.job.address && <Row k="Adresa" v={<span style={{ whiteSpace: "normal" }}>{c.job.address}</span>} />}
        {c.job.note && <Row k="Poznámka" v={<span style={{ whiteSpace: "normal", fontWeight: 400 }}>{c.job.note}</span>} />}
        {owner && (
          <div className="firm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {owner.logo && <img src={owner.logo} alt="Logo" />}
            <div>
              <b>{owner.company || owner.name || "Vaše firma"}</b>
              <div className="small muted">
                {[owner.name, owner.ico ? `IČO ${owner.ico}` : "", owner.phone].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

