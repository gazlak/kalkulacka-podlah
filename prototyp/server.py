"""Lokální server prototypu: servíruje soubory bez cache a dělá vizualizaci schodů přes Gemini.

    python3 prototyp/server.py [port]        (výchozí 8801)

Klíč k Gemini: proměnná GEMINI_API_KEY, jinak soubor ~/.config/gemini/api_key. Do prohlížeče se nikdy neposílá.
Výsledky se ukládají do prototyp/vizualizace/ (mimo git). Spec: docs/superpowers/specs/2026-10-20-vizualizace-schodu-design.md
"""
from __future__ import annotations

import base64
import http.server
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "vizualizace")
LIMIT = 2
MAX_BYTES = 10 * 1024 * 1024
TIMEOUT_S = 90
MODEL = "gemini-3.1-flash-image"
API = "https://generativelanguage.googleapis.com/v1beta"
DECOR_HOST = "https://eshop.floorforever.cz/"
CALC_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
RATIOS = {"1:1": 1, "3:4": 3 / 4, "4:3": 4 / 3, "2:3": 2 / 3, "3:2": 3 / 2, "9:16": 9 / 16, "16:9": 16 / 9}
SIDES = {
    "walls": "both sides of the staircase are against walls: finish both side edges with a thin skirting trim strip",
    "openLeft": "the left side is open (no wall): finish it with a matching vinyl edge profile; the right side is "
                "against the wall: thin skirting trim strip",
    "openRight": "the right side is open (no wall): finish it with a matching vinyl edge profile; the left side is "
                 "against the wall: thin skirting trim strip",
    "openBoth": "both sides are open (no walls): finish both side edges with a matching vinyl edge profile",
}


class GeminiError(Exception):
    pass


def api_key() -> str:
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    f = os.path.expanduser("~/.config/gemini/api_key")
    if not k and os.path.exists(f):
        with open(f) as fh:
            k = fh.read().strip()
    return k


def _ssl_context() -> ssl.SSLContext:
    try:
        import certifi  # python.org Python na macOS nemá certifikáty v systému
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def image_kind(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return None


def image_size(data: bytes) -> tuple[int, int] | None:
    """Rozměr JPEG/PNG z hlavičky (bez Pillow)."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            return None
        marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
        i += 2 + length
    return None


def aspect_ratio(size: tuple[int, int] | None) -> str:
    if not size or not size[1]:
        return "3:4"
    r = size[0] / size[1]
    return min(RATIOS, key=lambda k: abs(RATIOS[k] - r))


def build_prompt(pattern_name: str, stair: dict, has_decor: bool) -> str:
    decor = f"the vinyl flooring shown in the SECOND image ({pattern_name})" if has_decor else \
        f"vinyl flooring with the decor \"{pattern_name}\""
    nose = ("Each tread has a nosing: the tread overhangs the riser by about 2 cm with a rounded front edge."
            if stair.get("nose") else
            "Treads have NO nosing: the tread ends flush with the riser, square edge, no overhang.")
    lines = [
        "Edit the FIRST image, a photo of a real staircase.",
        f"Cover every stair tread (the horizontal step surfaces) and every riser (the vertical fronts of the steps) "
        f"with {decor}. Match its colour, pattern and wood grain exactly. Planks run along the width of each tread "
        "(left to right), the same direction on the risers.",
        nose,
        "Sides: " + SIDES.get(stair.get("stairSide") or "walls", SIDES["walls"]) + ".",
    ]
    if stair.get("landing"):
        lines.append("The landing (the larger flat area between flights) is covered with the same vinyl.")
    lines += [
        "Do NOT cover the floor in front of or below the staircase, walls, railings or anything else with vinyl.",
        "Keep everything else exactly as in the original photo: walls, railing, balusters, windows, objects, "
        "lighting, shadows, camera angle, perspective, framing, and the number and shape of the steps.",
        "Photorealistic result, like a finished professional installation. No text, no watermarks.",
    ]
    return "\n".join(lines)


def fetch_decor(url: str) -> tuple[bytes, str] | None:
    if not isinstance(url, str) or not url.startswith(DECOR_HOST):
        return None
    try:
        with urllib.request.urlopen(url, timeout=20, context=_ssl_context()) as r:
            data = r.read(MAX_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    kind = image_kind(data)
    return (data, kind) if kind and len(data) <= MAX_BYTES else None


def call_gemini(key: str, prompt: str, photo: bytes, photo_mime: str, decor: tuple[bytes, str] | None,
                ratio: str) -> bytes:
    parts = [{"text": prompt}, {"inline_data": {"mime_type": photo_mime, "data": base64.b64encode(photo).decode()}}]
    if decor:
        parts.append({"inline_data": {"mime_type": decor[1], "data": base64.b64encode(decor[0]).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"],
                                 "imageConfig": {"aspectRatio": ratio, "imageSize": "2K"}}}
    req = urllib.request.Request(f"{API}/models/{MODEL}:generateContent", data=json.dumps(body).encode(),
                                 headers={"x-goog-api-key": key, "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=_ssl_context()) as r:
            res = json.load(r)
    except TimeoutError:
        raise
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = json.loads(e.read()).get("error", {}).get("status", "")
        except (ValueError, AttributeError):
            pass
        raise GeminiError(f"Gemini odmítl požadavek (HTTP {e.code} {detail})".strip())
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError):
            raise TimeoutError from e
        raise GeminiError("Gemini není dostupný")
    for cand in res.get("candidates") or []:
        for p in (cand.get("content") or {}).get("parts") or []:
            d = p.get("inlineData") or p.get("inline_data")
            if d and d.get("data"):
                return base64.b64decode(d["data"])
    reason = ((res.get("candidates") or [{}])[0].get("finishReason")
              or (res.get("promptFeedback") or {}).get("blockReason") or "bez obrázku")
    raise GeminiError(f"Gemini nevrátil obrázek ({reason})")


def to_jpeg(data: bytes, path_no_ext: str) -> str:
    """Uloží obrázek jako JPEG (přes sips na macOS), jinak v původním formátu. Vrací jméno souboru."""
    if image_kind(data) == "image/jpeg":
        path = path_no_ext + ".jpg"
        with open(path, "wb") as f:
            f.write(data)
        return os.path.basename(path)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(data)
    path = path_no_ext + ".jpg"
    try:
        if shutil.which("sips"):
            subprocess.run(["sips", "-Z", "1600", "-s", "format", "jpeg", "-s", "formatOptions", "80", tmp.name, "--out", path],
                           check=True, capture_output=True, timeout=30)
            return os.path.basename(path)
    except (subprocess.SubprocessError, OSError):
        pass
    finally:
        os.unlink(tmp.name)
    path = path_no_ext + ".png"
    with open(path, "wb") as f:
        f.write(data)
    return os.path.basename(path)


def used(calc_id: str) -> int:
    if not os.path.isdir(OUT_DIR):
        return 0
    pat = re.compile(rf"^{re.escape(calc_id)}-\d+\.(jpg|png)$")
    return sum(1 for n in os.listdir(OUT_DIR) if pat.match(n))


DATA_DIR = os.path.join(ROOT, "data")
DB_FILE = os.path.join(DATA_DIR, "db.json")
PRICING_KEYS = ("rates", "patterns", "collections")
_db_lock = threading.Lock()


def db_read() -> dict | None:
    """Společná data prototypu ({"rev": n, "db": {...}}), nebo None, když ještě nikdo nic neuložil."""
    try:
        with open(DB_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _by_id(items) -> dict:
    return {x.get("id"): x for x in items or [] if isinstance(x, dict) and x.get("id")}


def db_merge(server: dict, incoming: dict, pricing_changed: bool) -> dict:
    """Sloučí data jednoho prohlížeče se společnými. Kalkulace po id (novější updatedAt vyhrává), uživatelé po id,
    tokeny sjednotí. Ceník (sazby, vzory, kolekce) se přepíše, jen když ho tento prohlížeč změnil. Nic se nemaže."""
    out = dict(server)
    for k, v in incoming.items():
        if k in ("calculations", "users", "tokens") or k in PRICING_KEYS:
            continue
        out[k] = v
    calcs = _by_id(server.get("calculations"))
    for c in incoming.get("calculations") or []:
        cur = calcs.get(c.get("id"))
        if cur is None or (c.get("updatedAt") or 0) >= (cur.get("updatedAt") or 0):
            calcs[c.get("id")] = c
    out["calculations"] = list(calcs.values())
    users = _by_id(server.get("users"))
    users.update(_by_id(incoming.get("users")))
    out["users"] = list(users.values())
    out["tokens"] = {**(server.get("tokens") or {}), **(incoming.get("tokens") or {})}
    if pricing_changed:
        for k in PRICING_KEYS:
            if k in incoming:
                out[k] = incoming[k]
    return out


def db_write(body: dict) -> tuple[int, dict]:
    db = body.get("db") if isinstance(body, dict) else None
    if not isinstance(db, dict) or not isinstance(db.get("calculations"), list) or not isinstance(db.get("users"), list):
        return 400, {"error": "Neplatná data"}
    with _db_lock:
        cur = db_read()
        if cur and not body.get("replace"):
            db = db_merge(cur.get("db") or {}, db, bool(body.get("pricingChanged")))
        rec = {"rev": (cur or {}).get("rev", 0) + 1, "db": db}
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = DB_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False)
        os.replace(tmp, DB_FILE)
        return 200, rec


class Handler(http.server.SimpleHTTPRequestHandler):
    gemini = staticmethod(call_gemini)  # testy podvrhnou
    decor = staticmethod(fetch_decor)

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/vizualizace/stav":
            calc = (urllib.parse.parse_qs(u.query).get("calc") or [""])[0]
            n = used(calc) if CALC_ID.match(calc) else 0
            return self._json(200, {"ok": True, "key": bool(api_key()), "used": n, "limit": LIMIT})
        if u.path == "/api/db":
            rec = db_read()
            return self._json(200, rec or {"rev": 0, "db": None})  # bez dat: prázdné, ať prohlížeč nehlásí chybu
        if u.path.startswith("/api/") or u.path.startswith("/data/"):
            return self._json(404, {"error": "Neznámá adresa"})
        return super().do_GET()

    def do_PUT(self):
        if urllib.parse.urlparse(self.path).path != "/api/db":
            return self._json(404, {"error": "Neznámá adresa"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 60 * 1024 * 1024:
            return self._json(400, {"error": "Neplatná velikost dat"})
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return self._json(400, {"error": "Neplatný požadavek"})
        code, obj = db_write(body)
        return self._json(code, obj)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/vizualizace":
            return self._json(404, {"error": "Neznámá adresa"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES * 2:
            return self._json(400, {"error": "Fotka je příliš velká (nejvýš 10 MB)"})
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return self._json(400, {"error": "Neplatný požadavek"})
        code, obj = visualize(body, type(self).gemini, type(self).decor)
        return self._json(code, obj)


def visualize(body: dict, gemini=call_gemini, decor_fetch=fetch_decor) -> tuple[int, dict]:
    calc_id = body.get("calcId") if isinstance(body, dict) else None
    if not isinstance(calc_id, str) or not CALC_ID.match(calc_id):
        return 400, {"error": "Chybí nebo je neplatné ID kalkulace"}
    pattern, stair = body.get("pattern") or {}, body.get("stair") or {}
    name = str(pattern.get("name") or "").strip()[:120]
    if not name:
        return 400, {"error": "Chybí vybraný dekor"}
    photo_url = body.get("photo") or ""
    m = re.match(r"^data:image/[a-z+]+;base64,(.+)$", photo_url, re.S) if isinstance(photo_url, str) else None
    if not m:
        return 400, {"error": "Chybí fotka"}
    try:
        photo = base64.b64decode(m.group(1), validate=True)
    except ValueError:
        return 400, {"error": "Fotku se nepodařilo přečíst"}
    if len(photo) > MAX_BYTES:
        return 400, {"error": "Fotka je příliš velká (nejvýš 10 MB)"}
    mime = image_kind(photo)
    if not mime:
        return 400, {"error": "Podporované jsou fotky JPG a PNG"}
    n = used(calc_id)
    if n >= LIMIT:
        return 409, {"error": f"Limit vizualizací pro tuto kalkulaci je vyčerpán ({LIMIT}/{LIMIT})", "used": n,
                     "limit": LIMIT}
    key = api_key()
    if not key:
        return 503, {"error": "Chybí klíč ke Gemini (GEMINI_API_KEY nebo ~/.config/gemini/api_key)"}
    decor = decor_fetch(pattern.get("photo"))
    prompt = build_prompt(name, stair if isinstance(stair, dict) else {}, decor is not None)
    t = time.time()
    try:
        result = gemini(key, prompt, photo, mime, decor, aspect_ratio(image_size(photo)))
    except TimeoutError:
        return 504, {"error": "Vizualizace trvala příliš dlouho, zkuste to znovu"}
    except GeminiError as e:
        return 502, {"error": str(e)}
    if not image_kind(result):
        return 502, {"error": "Gemini vrátil neplatný obrázek"}
    os.makedirs(OUT_DIR, exist_ok=True)
    idx = n + 1
    while os.path.exists(os.path.join(OUT_DIR, f"{calc_id}-{idx}.jpg")) or \
            os.path.exists(os.path.join(OUT_DIR, f"{calc_id}-{idx}.png")):
        idx += 1
    out = to_jpeg(result, os.path.join(OUT_DIR, f"{calc_id}-{idx}"))
    orig = to_jpeg(photo, os.path.join(OUT_DIR, f"{calc_id}-{idx}-foto"))
    sys.stderr.write(f"vizualizace {calc_id}-{idx}: {time.time() - t:.0f} s\n")
    return 200, {"url": f"vizualizace/{out}", "original": f"vizualizace/{orig}", "used": used(calc_id),
                 "limit": LIMIT}


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8801
    host = os.environ.get("HOST", "127.0.0.1")  # HOST=0.0.0.0 zpřístupní prototyp i ostatním v síti
    srv = http.server.ThreadingHTTPServer((host, port), Handler)
    print(f"Prototyp: http://{'localhost' if host == '127.0.0.1' else host}:{port}  (Gemini klíč: {'ano' if api_key() else 'chybí'}, "
          f"společná data: {DB_FILE})")
    srv.serve_forever()


if __name__ == "__main__":
    main()
