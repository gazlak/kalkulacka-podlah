/* SVG textury místo fotek vzorů (port z prototyp/data.js). */
import type { Pattern, TextureKind } from "./types";

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function planks(t: string, narrow: boolean): string {
  const r = rnd(narrow ? 7 : 3);
  const h = narrow ? 14 : 22;
  let out = "";
  for (let y = 0; y < 120; y += h) {
    let x = -r() * 60;
    while (x < 160) {
      const w = 50 + r() * 50;
      out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" fill="${shade(t, 0.88 + r() * 0.24)}" stroke="${shade(t, 0.6)}" stroke-width=".7"/>`;
      out += `<path d="M${x + 4} ${y + h * 0.35}h${(w * 0.5).toFixed(1)}M${x + w * 0.3} ${y + h * 0.7}h${(w * 0.5).toFixed(1)}" stroke="${shade(t, 0.75)}" stroke-width=".5" opacity=".6"/>`;
      x += w;
    }
  }
  return out;
}

function herringbone(t: string): string {
  const r = rnd(11);
  const s = 16;
  let out = "";
  let k = 0;
  for (let y = -s; y < 130; y += s) {
    for (let x = -s * 2; x < 170; x += s * 2) {
      const o = (k % 2) * s;
      out += `<polygon points="${x + o},${y} ${x + o + s * 2},${y + s} ${x + o + s * 2 - 5},${y + s + 5} ${x + o - 5},${y + 5}" fill="${shade(t, 0.85 + r() * 0.3)}" stroke="${shade(t, 0.55)}" stroke-width=".7"/>`;
      out += `<polygon points="${x + o + s * 2},${y + s} ${x + o + s * 2},${y + s * 2 + 4} ${x + o + s * 2 - 5},${y + s * 2 + 9} ${x + o + s * 2 - 5},${y + s + 5}" fill="${shade(t, 0.8 + r() * 0.3)}" stroke="${shade(t, 0.55)}" stroke-width=".7"/>`;
    }
    k++;
  }
  return out;
}

function parquet(t: string): string {
  const r = rnd(5);
  const s = 30;
  let out = "";
  for (let y = 0; y < 120; y += s)
    for (let x = 0; x < 160; x += s) {
      const horiz = (x / s + y / s) % 2 === 0;
      const f = shade(t, 0.85 + r() * 0.3);
      for (let i = 0; i < 3; i++) {
        out += horiz
          ? `<rect x="${x}" y="${y + (i * s) / 3}" width="${s}" height="${s / 3}"`
          : `<rect x="${x + (i * s) / 3}" y="${y}" width="${s / 3}" height="${s}"`;
        out += ` fill="${i % 2 ? f : shade(t, 1.08)}" stroke="${shade(t, 0.5)}" stroke-width=".6"/>`;
      }
    }
  return out;
}

function stone(t: string): string {
  const r = rnd(9);
  let out = `<rect width="160" height="120" fill="${shade(t, 0.5)}"/>`;
  for (let y = 2; y < 120; y += 30)
    for (let x = 2; x < 160; x += 40) {
      const w = 34 + r() * 4;
      const h = 26 + r() * 2;
      const f = shade(t, 0.8 + r() * 0.4);
      out += `<rect x="${x + (y % 60 ? 0 : 10)}" y="${y}" width="${w}" height="${h}" rx="3" fill="${f}"/>`;
      out += `<path d="M${x + 6} ${y + 8}q10 6 20 0M${x + 10} ${y + 18}q8 -5 18 2" stroke="${shade(t, 0.6)}" stroke-width=".7" fill="none" opacity=".6"/>`;
    }
  return out;
}

function svg(kind: TextureKind, tint: string): string {
  const body =
    kind === "herringbone" ? herringbone(tint)
    : kind === "parquet" ? parquet(tint)
    : kind === "stone" ? stone(tint)
    : kind === "laminate" ? planks(tint, true)
    : planks(tint, false);
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice"><rect width="160" height="120" fill="${tint}"/>${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

const cache = new Map<string, string>();

export function textureUri(kind: TextureKind, tint: string): string {
  const k = kind + tint;
  let v = cache.get(k);
  if (!v) cache.set(k, (v = svg(kind, tint)));
  return v;
}

export function patternImg(p: Pattern): string {
  return p.photo || textureUri(p.texture, p.tint);
}
