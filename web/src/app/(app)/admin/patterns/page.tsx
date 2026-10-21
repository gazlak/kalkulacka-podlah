"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { TopBar } from "@/components/chrome/TopBar";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/misc";
import { useUi } from "@/components/ui/UiProvider";
import { num } from "@/lib/calc";
import { api } from "@/lib/api";
import { keys } from "@/lib/hooks";
import { readImage } from "@/lib/image";
import { fieldErrors, patternSchema } from "@/lib/schemas";
import { patternImg, textureUri } from "@/lib/textures";
import type { Pattern } from "@/lib/types";

export default function PatternsPage() {
  const patterns = useQuery({ queryKey: keys.patterns, queryFn: () => api.patterns.list() });
  return (
    <>
      <TopBar title="Správa" />
      <AdminTabs />
      <Alert kind="info">
        Vzory jsou přesně 6 (nepřidávají se ani nemažou). Změna cen se projeví jen v nových kalkulacích – uložené kalkulace drží své ceny (snapshot).
      </Alert>
      {patterns.data?.map((p) => <PatternForm key={p.id} pattern={p} />)}
    </>
  );
}

function PatternForm({ pattern: p }: { pattern: Pattern }) {
  const qc = useQueryClient();
  const { toast } = useUi();
  const [f, setF] = useState({
    name: p.name, materialPerM2: String(p.materialPerM2), wastePct: String(p.wastePct), laborPerTread: String(p.laborPerTread),
  });
  // undefined = beze změny, null = výchozí textura, string = nová fotka
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const img = photo === undefined ? patternImg(p) : photo ?? textureUri(p.texture, p.tint);

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setPhoto(await readImage(file, 600));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = patternSchema.safeParse({
      name: f.name, materialPerM2: num(f.materialPerM2), wastePct: num(f.wastePct), laborPerTread: num(f.laborPerTread),
    });
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    try {
      await api.patterns.update(p.id, { ...r.data, photo });
      qc.invalidateQueries({ queryKey: keys.patterns });
      qc.invalidateQueries({ queryKey: keys.pricing });
      setPhoto(undefined);
      toast(`Vzor ${p.id} uložen`);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  const numField = (k: "materialPerM2" | "wastePct" | "laborPerTread", label: string) => (
    <Field label={label} error={errors[k]}>
      <Input type="text" name={k} inputMode="decimal" value={f[k]} onChange={set(k)} error={errors[k]} />
    </Field>
  );

  return (
    <form className="card pat-admin" onSubmit={submit} noValidate>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cover" src={img} alt="" />
      <div className="pbody">
        <div className="photo-actions">
          <label className="btn sm tonal">
            <Icon name="plus" />Nahrát fotku
            <input type="file" className="sr" accept="image/*" aria-label={`Fotka vzoru ${p.id}`} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button type="button" className="btn sm ghost" onClick={() => setPhoto(null)}>Výchozí textura</button>
        </div>
        <Field label={`Název vzoru ${p.id}`} htmlFor={`pn${p.id}`} error={errors.name}>
          <Input type="text" id={`pn${p.id}`} name="name" value={f.name} onChange={set("name")} error={errors.name} />
        </Field>
        <div className="group-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
          {numField("materialPerM2", "Materiál (Kč/m²)")}
          {numField("wastePct", "Prořez (%)")}
          {numField("laborPerTread", "Práce (Kč/nášlap)")}
        </div>
        <button className="btn primary block" type="submit">Uložit vzor {p.id}</button>
      </div>
    </form>
  );
}
