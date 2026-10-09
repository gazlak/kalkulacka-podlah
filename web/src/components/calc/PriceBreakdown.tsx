import { formatCZK, formatM2, formatPct, n0 } from "@/lib/calc";
import { Row } from "@/components/ui/misc";
import type { Discount, Pattern, Quote, Rates } from "@/lib/types";

export function PriceBreakdown({
  quote, pattern, rates, discount, vatRate,
}: { quote: Quote; pattern: Pattern; rates: Rates; discount: Discount; vatRate: number }) {
  const q = quote;
  return (
    <div className="list">
      <Row k="Materiál vč. prořezu"
        sub={`${formatM2(q.totalArea)} × ${(1 + pattern.wastePct / 100).toLocaleString("cs-CZ")} × ${formatCZK(pattern.materialPerM2)}`}
        v={formatCZK(q.material)} />
      <Row k="Práce" sub={`${q.treads} nášlapů × ${formatCZK(pattern.laborPerTread)}`} v={formatCZK(q.labor)} />
      <Row k="Obklad podstupnic" sub={`${q.riserTreads} ks × ${formatCZK(rates.riserSurcharge)}`} v={formatCZK(q.risers)} />
      <Row k="Doprava" v={formatCZK(q.transport)} />
      {rates.extrasEnabled && q.extras > 0 && <Row k="Volitelné příplatky" v={formatCZK(q.extras)} />}
      {q.discountAmount > 0 && (
        <>
          <Row k="Mezisoučet" v={formatCZK(q.subtotal)} />
          <Row k="Sleva" sub={discount.type === "pct" ? `${n0(discount.value)} %` : undefined} v={`− ${formatCZK(q.discountAmount)}`} cls="minus" />
        </>
      )}
      <Row k="Cena bez DPH" v={formatCZK(q.base)} cls="tot" />
      <Row k={`DPH ${formatPct(vatRate)}`} v={formatCZK(q.vat)} />
      <Row k="Celkem s DPH" sub={rates.roundTo > 1 ? `zaokrouhleno na ${rates.roundTo} Kč` : undefined} v={formatCZK(q.total)} cls="tot" />
    </div>
  );
}
