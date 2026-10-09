import { formatCZK, formatPct } from "@/lib/calc";
import type { Quote, Rates } from "@/lib/types";

export function HeroPrice({ quote, vatRate, rates }: { quote: Quote; vatRate: number; rates: Rates }) {
  return (
    <>
      <div className="big">{formatCZK(quote.total)}</div>
      <div className="sub">
        bez DPH {formatCZK(quote.base)} · DPH {formatPct(vatRate)} {formatCZK(quote.vat)}
        {rates.roundTo > 1 && ` · zaokrouhleno na ${rates.roundTo} Kč`}
      </div>
    </>
  );
}
