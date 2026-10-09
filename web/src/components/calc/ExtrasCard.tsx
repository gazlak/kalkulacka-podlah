import { formatCZK } from "@/lib/calc";
import { Icon } from "@/components/ui/Icon";
import type { Rates } from "@/lib/types";
import { n0 } from "@/lib/calc";

export function ExtrasCard({
  rates, values, readOnly, onChange,
}: { rates: Rates; values: Record<string, number | string>; readOnly: boolean; onChange: (key: string, v: string) => void }) {
  const on = rates.extrasEnabled;
  const anyValue = on && Object.keys(values).some((k) => n0(values[k]) > 0);
  return (
    <details className="list fold-card" open={anyValue || undefined}>
      <summary>
        <span>Volitelné příplatky <span className="badge st-pozván">návrh</span></span>
        <Icon name="chev-d" />
      </summary>
      {!on && (
        <div className="pad small muted">
          Sekce je zatím vypnutá a do výpočtu nezasahuje. Zapnout ji může správce v Sazbách (po odsouhlasení se zákazníkem).
        </div>
      )}
      {rates.extras.map((e) => (
        <div className="extra-row" key={e.key}>
          <span className="nm">{e.label}<small>{formatCZK(e.price)} / {e.unit}</small></span>
          {on ? (
            <span className="inline-unit">
              <input type="text" inputMode="decimal" aria-label={e.label} disabled={readOnly} placeholder="0"
                value={String(values[e.key] ?? "")} onChange={(ev) => onChange(e.key, ev.target.value)} />
              <span>{e.unit}</span>
            </span>
          ) : <span />}
        </div>
      ))}
    </details>
  );
}
