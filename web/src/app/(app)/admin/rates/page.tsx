"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { TopBar } from "@/components/chrome/TopBar";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useUi } from "@/components/ui/UiProvider";
import { num } from "@/lib/calc";
import { api } from "@/lib/api";
import { keys } from "@/lib/hooks";
import { fieldErrors, ratesFormSchema } from "@/lib/schemas";
import type { Rates } from "@/lib/types";

export default function RatesPage() {
  const rates = useQuery({ queryKey: keys.rates, queryFn: () => api.rates.get() });
  return (
    <>
      <TopBar title="Správa" />
      <AdminTabs />
      {rates.data && <RatesForm rates={rates.data} />}
    </>
  );
}

function RatesForm({ rates: r }: { rates: Rates }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast, confirm } = useUi();
  const [f, setF] = useState({
    riserSurcharge: String(r.riserSurcharge),
    transport: String(r.transport),
    vatDefault: String(r.vatDefault),
    roundTo: String(r.roundTo),
    extrasEnabled: r.extrasEnabled,
    extras: Object.fromEntries(r.extras.map((x) => [x.key, String(x.price)])),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = ratesFormSchema.safeParse({
      riserSurcharge: num(f.riserSurcharge),
      transport: num(f.transport),
      vatDefault: parseFloat(f.vatDefault),
      roundTo: parseInt(f.roundTo, 10),
      extrasEnabled: f.extrasEnabled,
      extras: Object.fromEntries(Object.entries(f.extras).map(([k, v]) => [k, num(v)])),
    });
    if (!p.success) return setErrors(fieldErrors(p.error));
    setErrors({});
    try {
      await api.rates.update({
        ...r,
        riserSurcharge: p.data.riserSurcharge,
        transport: p.data.transport,
        vatDefault: p.data.vatDefault,
        roundTo: p.data.roundTo,
        extrasEnabled: p.data.extrasEnabled,
        extras: r.extras.map((x) => ({ ...x, price: p.data.extras[x.key] })),
      });
      qc.invalidateQueries({ queryKey: keys.rates });
      qc.invalidateQueries({ queryKey: keys.pricing });
      toast("Sazby uloženy");
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function resetDemo() {
    const ok = await confirm({
      title: "Obnovit ukázková data?",
      text: "Všechny změny (kalkulace, ceník, uživatelé) se vrátí do původního stavu.",
      okLabel: "Obnovit", danger: true,
    });
    if (!ok) return;
    await api.dev?.reset();
    await api.auth.logout();
    qc.clear();
    toast("Ukázková data obnovena");
    router.replace("/login");
  }

  return (
    <>
      <form onSubmit={submit} noValidate>
        <div className="section-title">Globální sazby</div>
        <div className="card">
          <Field label="Příplatek za obklad podstupnice (Kč/nášlap)" error={errors.riserSurcharge}>
            <Input type="text" name="riserSurcharge" inputMode="decimal" value={f.riserSurcharge} error={errors.riserSurcharge}
              onChange={(e) => setF({ ...f, riserSurcharge: e.target.value })} />
          </Field>
          <Field label="Doprava (Kč, paušál)" error={errors.transport}>
            <Input type="text" name="transport" inputMode="decimal" value={f.transport} error={errors.transport}
              onChange={(e) => setF({ ...f, transport: e.target.value })} />
          </Field>
          <Field label="Výchozí DPH" htmlFor="vd" hint="Na kalkulaci lze přepnout 21 % / 12 %.">
            <Select id="vd" name="vatDefault" value={f.vatDefault} onChange={(e) => setF({ ...f, vatDefault: e.target.value })}>
              {r.vatOptions.map((v) => <option key={v} value={v}>{Math.round(v * 100)} %</option>)}
            </Select>
          </Field>
          <Field label="Zaokrouhlení" htmlFor="rt" flush>
            <Select id="rt" name="roundTo" value={f.roundTo} onChange={(e) => setF({ ...f, roundTo: e.target.value })}>
              <option value="1">na celé Kč</option>
              <option value="10">na 10 Kč (ukázka)</option>
            </Select>
          </Field>
        </div>
        <div className="section-title">Volitelné příplatky (návrh)</div>
        <div className="card">
          <label className="check">
            <span>Zapnout příplatky v kalkulaci<small className="muted" style={{ display: "block" }}>Mimo původní zadání</small></span>
            <input type="checkbox" name="extrasEnabled" checked={f.extrasEnabled} onChange={(e) => setF({ ...f, extrasEnabled: e.target.checked })} />
          </label>
          <div className="mt">
            {r.extras.map((x) => (
              <Field key={x.key} label={`${x.label} (Kč/${x.unit})`} error={errors[`extras.${x.key}`]}>
                <Input type="text" name={`x_${x.key}`} inputMode="decimal" value={f.extras[x.key]} error={errors[`extras.${x.key}`]}
                  onChange={(e) => setF({ ...f, extras: { ...f.extras, [x.key]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </div>
        <button className="btn primary block" type="submit">Uložit sazby</button>
      </form>
      {api.dev && (
        <>
          <div className="section-title">Demo data</div>
          <div className="card">
            <p className="small muted">Vrátí ceník, uživatele i kalkulace na původní ukázková data.</p>
            <button className="btn danger block" onClick={resetDemo}><Icon name="refresh" />Obnovit ukázková data</button>
          </div>
        </>
      )}
    </>
  );
}
