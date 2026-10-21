import { formatPct } from "@/lib/calc";
import { Seg } from "@/components/ui/Seg";
import type { Discount, Rates } from "@/lib/types";

export function DiscountVatCard({
  discount, vatRate, rates, error, readOnly, onDiscount, onVat,
}: {
  discount: Discount;
  vatRate: number;
  rates: Rates;
  error: string;
  readOnly: boolean;
  onDiscount: (d: Discount) => void;
  onVat: (v: number) => void;
}) {
  return (
    <div className="card">
      <div className="lbl">Sleva</div>
      <div className="disc-grid">
        <Seg label="Typ slevy" disabled={readOnly} value={discount.type} onChange={(type) => onDiscount({ ...discount, type })}
          options={[{ value: "pct", label: "%" }, { value: "czk", label: "Kč" }]} />
        <input
          type="text" inputMode="decimal" aria-label="Výše slevy" disabled={readOnly} placeholder="0"
          className={error ? "invalid" : undefined} value={String(discount.value || "")}
          onChange={(e) => onDiscount({ ...discount, value: e.target.value })}
        />
      </div>
      <div className="err">{error}</div>
      <div className="lbl mt">Sazba DPH</div>
      <Seg label="Sazba DPH" full disabled={readOnly} value={vatRate} onChange={onVat}
        options={(rates.vatOptions ?? [0.21, 0.12]).map((v) => ({ value: v, label: formatPct(v) }))} />
    </div>
  );
}
