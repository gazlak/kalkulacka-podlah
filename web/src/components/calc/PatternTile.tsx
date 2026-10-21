import { formatCZK } from "@/lib/calc";
import { Icon } from "@/components/ui/Icon";
import { patternImg } from "@/lib/textures";
import type { Pattern } from "@/lib/types";

export function PatternTile({
  pattern, selected, total, cheapest, onPick,
}: { pattern: Pattern; selected: boolean; total: number | null; cheapest: boolean; onPick: () => void }) {
  return (
    <label className={`tile${selected ? " selected" : ""}`}>
      <input type="radio" name="pattern" value={pattern.id} checked={selected} onChange={onPick} />
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={patternImg(pattern)} alt={pattern.name} />
        {cheapest && <span className="ov">Nejlevnější</span>}
        <span className="tick"><Icon name="check" /></span>
      </div>
      <div className="t">
        <b>{pattern.name}</b>
        <span className="small muted">{formatCZK(pattern.materialPerM2)} / m²</span>
        {total !== null && (
          <div className="tot"><b>{formatCZK(total)}</b> <span className="muted">s DPH</span></div>
        )}
      </div>
    </label>
  );
}
