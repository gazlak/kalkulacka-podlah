"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionBar, BackButton } from "@/components/chrome/ActionBar";
import { TopBar } from "@/components/chrome/TopBar";
import { PdfSheet } from "@/components/calc/PdfSheet";
import { Icon } from "@/components/ui/Icon";
import { useUi } from "@/components/ui/UiProvider";
import { useOwner, usePricing } from "@/lib/hooks";
import { patternOf, pricingOf, quoteOf } from "@/lib/quote";
import { useCalcDraft } from "@/lib/useCalcDraft";

export default function PdfPage() {
  const { id } = useParams<{ id: string }>();
  return <Pdf key={id} id={id} />;
}

function Pdf({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useUi();
  const { calc: c, load } = useCalcDraft(id);
  const pricing = usePricing();
  const owner = useOwner(c?.ownerId).data?.profile;

  useEffect(() => {
    if (load === "missing") {
      toast("Kalkulace nenalezena");
      router.replace("/history");
    } else if (c && !c.number) router.replace(`/wizard/${id}/1`);
  }, [load, c, id, router, toast]);

  if (!c?.number || !pricing.data || !owner) return null;
  const pat = patternOf(c, pricing.data);
  if (!pat) return null;
  const back = `/calc/${id}`;

  return (
    <>
      <TopBar title="Náhled PDF" back={back} />
      <PdfSheet calc={c} pattern={pat} quote={quoteOf(c, pricing.data)} rates={pricingOf(c, pricing.data).rates} owner={owner} />
      <ActionBar>
        <BackButton href={back} />
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" />Tisk / Uložit jako PDF</button>
      </ActionBar>
    </>
  );
}
