"""Testy lokálního serveru vizualizace: python3 -m unittest prototyp/test_server.py (Gemini je podvržený)."""
import base64
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server  # noqa: E402

# nejmenší platné obrázky: JPEG 4×3 px (hlavička SOF0) a PNG 1×1
JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d"
    "1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080003000401011100ffc4001f0000010501010101"
    "010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107"
    "227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a63"
    "6465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9"
    "cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd3ffd9")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
DECOR = "https://eshop.floorforever.cz/wp-content/uploads/2023/09/5008-DESIGN-VINYL-HOME-dekor-400x250.jpg"


def body(**kw):
    b = {"calcId": "c1", "photo": "data:image/jpeg;base64," + base64.b64encode(JPEG).decode(),
         "pattern": {"name": "5008 LEPENÁ 0,3", "photo": DECOR},
         "stair": {"nose": True, "stairSide": "walls", "stairType": "straight", "landing": False}}
    b.update(kw)
    return b


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.old = server.OUT_DIR
        server.OUT_DIR = os.path.join(self.tmp, "vizualizace")
        os.environ["GEMINI_API_KEY"] = "test-key"
        self.calls = []

    def tearDown(self):
        server.OUT_DIR = self.old
        shutil.rmtree(self.tmp)
        os.environ.pop("GEMINI_API_KEY", None)

    def gemini(self, key, prompt, photo, mime, decor, ratio):
        self.calls.append({"key": key, "prompt": prompt, "mime": mime, "decor": decor, "ratio": ratio})
        return JPEG

    def decor(self, url):
        return (JPEG, "image/jpeg") if url == DECOR else None

    def run_viz(self, b, gemini=None):
        return server.visualize(b, gemini or self.gemini, self.decor)


class VisualizeTest(Base):
    def test_success_saves_files_and_counts(self):
        code, res = self.run_viz(body())
        self.assertEqual(code, 200, res)
        self.assertEqual(res["url"], "vizualizace/c1-1.jpg")
        self.assertEqual(res["original"], "vizualizace/c1-1-foto.jpg")
        self.assertEqual((res["used"], res["limit"]), (1, 2))
        self.assertTrue(os.path.exists(os.path.join(server.OUT_DIR, "c1-1.jpg")))
        self.assertEqual(self.calls[0]["key"], "test-key")
        self.assertEqual(self.calls[0]["ratio"], "4:3")  # fotka 4×3 px
        self.assertIsNotNone(self.calls[0]["decor"])

    def test_limit_two_per_calculation(self):
        self.assertEqual(self.run_viz(body())[0], 200)
        self.assertEqual(self.run_viz(body())[0], 200)
        code, res = self.run_viz(body())
        self.assertEqual(code, 409)
        self.assertIn("2/2", res["error"])
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.run_viz(body(calcId="c2"))[0], 200)  # jiná kalkulace má vlastní limit

    def test_bad_calc_id(self):
        for cid in ["", "../x", "a/b", "x" * 65, None]:
            self.assertEqual(self.run_viz(body(calcId=cid))[0], 400, cid)

    def test_photo_validation(self):
        self.assertEqual(self.run_viz(body(photo=""))[0], 400)
        not_image = "data:image/jpeg;base64," + base64.b64encode(b"GIF89a....").decode()
        code, res = self.run_viz(body(photo=not_image))
        self.assertEqual(code, 400)
        self.assertIn("JPG a PNG", res["error"])
        big = "data:image/jpeg;base64," + base64.b64encode(JPEG + b"0" * server.MAX_BYTES).decode()
        self.assertEqual(self.run_viz(body(photo=big))[0], 400)
        png = "data:image/png;base64," + base64.b64encode(PNG).decode()
        self.assertEqual(self.run_viz(body(photo=png))[0], 200)
        self.assertEqual(self.calls[-1]["mime"], "image/png")
        self.assertEqual(len(self.calls), 1)

    def test_missing_pattern(self):
        self.assertEqual(self.run_viz(body(pattern={"name": " "}))[0], 400)

    def test_missing_key(self):
        os.environ.pop("GEMINI_API_KEY")
        old = os.path.expanduser
        os.path.expanduser = lambda p: os.path.join(self.tmp, "neni")
        try:
            code, res = self.run_viz(body())
        finally:
            os.path.expanduser = old
        self.assertEqual(code, 503)
        self.assertNotIn("test-key", json.dumps(res))
        self.assertEqual(self.calls, [])

    def test_gemini_errors(self):
        def fail(*a):
            raise server.GeminiError("Gemini nevrátil obrázek (SAFETY)")

        def slow(*a):
            raise TimeoutError

        self.assertEqual(self.run_viz(body(), fail), (502, {"error": "Gemini nevrátil obrázek (SAFETY)"}))
        self.assertEqual(self.run_viz(body(), slow)[0], 504)
        self.assertEqual(self.run_viz(body(), lambda *a: b"not an image")[0], 502)
        self.assertEqual(server.used("c1"), 0)  # neúspěch limit nespotřebuje

    def test_foreign_decor_not_fetched(self):
        fetched = []
        code, _ = server.visualize(body(pattern={"name": "X", "photo": "https://evil.example/a.jpg"}), self.gemini,
                                   lambda u: fetched.append(u) or server.fetch_decor(u))
        self.assertEqual(code, 200)
        self.assertIsNone(self.calls[0]["decor"])
        self.assertIn('decor "X"', self.calls[0]["prompt"])
        self.assertIsNone(server.fetch_decor("https://evil.example/a.jpg"))
        self.assertIsNone(server.fetch_decor("file:///etc/passwd"))


class PromptTest(unittest.TestCase):
    def test_nose_and_flat(self):
        self.assertIn("overhangs the riser", server.build_prompt("D", {"nose": True}, True))
        p = server.build_prompt("D", {"nose": False}, True)
        self.assertIn("NO nosing", p)
        self.assertNotIn("overhangs the riser", p)

    def test_sides(self):
        self.assertIn("both sides of the staircase are against walls", server.build_prompt("D", {"stairSide": "walls"}, True))
        self.assertIn("left side is open", server.build_prompt("D", {"stairSide": "openLeft"}, True))
        self.assertIn("right side is open", server.build_prompt("D", {"stairSide": "openRight"}, True))
        self.assertIn("both sides are open", server.build_prompt("D", {"stairSide": "openBoth"}, True))
        self.assertIn("against walls", server.build_prompt("D", {"stairSide": "nesmysl"}, True))

    def test_landing_floor_and_decor(self):
        p = server.build_prompt("Dub 5008", {"landing": True}, True)
        self.assertIn("landing", p)
        self.assertIn("Do NOT cover the floor", p)
        self.assertIn("SECOND image (Dub 5008)", p)
        self.assertNotIn("landing", server.build_prompt("D", {}, True))

    def test_aspect_ratio(self):
        self.assertEqual(server.aspect_ratio((4032, 3024)), "4:3")
        self.assertEqual(server.aspect_ratio((1200, 1600)), "3:4")
        self.assertEqual(server.aspect_ratio((1920, 1080)), "16:9")
        self.assertEqual(server.aspect_ratio(None), "3:4")
        self.assertEqual(server.image_size(JPEG), (4, 3))
        self.assertEqual(server.image_size(PNG), (1, 1))


class HttpTest(Base):
    def setUp(self):
        super().setUp()
        test = self

        class H(server.Handler):
            gemini = staticmethod(lambda *a: test.gemini(*a))
            decor = staticmethod(lambda u: test.decor(u))

        self.srv = server.http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        super().tearDown()

    def req(self, path, data=None):
        r = urllib.request.Request(self.base + path, data=json.dumps(data).encode() if data is not None else None,
                                   headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(r) as resp:
                return resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read()

    def test_status_post_and_files(self):
        code, _, raw = self.req("/api/vizualizace/stav?calc=c1")
        self.assertEqual((code, json.loads(raw)), (200, {"ok": True, "key": True, "used": 0, "limit": 2}))
        code, _, raw = self.req("/api/vizualizace", body())
        self.assertEqual(code, 200, raw)
        self.assertEqual(json.loads(self.req("/api/vizualizace/stav?calc=c1")[2])["used"], 1)
        old = server.ROOT
        code, headers, _ = self.req("/index.html")
        self.assertEqual(code, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(old, server.ROOT)

    def test_unknown_api_and_bad_json(self):
        self.assertEqual(self.req("/api/nic")[0], 404)
        r = urllib.request.Request(self.base + "/api/vizualizace", data=b"{nejson", headers={"content-type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(r)
        self.assertEqual(e.exception.code, 400)


if __name__ == "__main__":
    unittest.main()


# ---- společná data (/api/db) ----
def _db(calcs, top=3500):
    return {"users": [{"id": "u1"}], "tokens": {}, "calculations": calcs, "rates": {"stairPrice": {"topPrice": top}},
            "patterns": [], "collections": []}


def test_db_merge_keeps_calcs_of_both_and_newer_wins():
    srv = _db([{"id": "a", "updatedAt": 5, "v": "srv"}, {"id": "b", "updatedAt": 1}])
    inc = _db([{"id": "a", "updatedAt": 3, "v": "old"}, {"id": "c", "updatedAt": 9}])
    out = server.db_merge(srv, inc, False)
    by = {c["id"]: c for c in out["calculations"]}
    assert set(by) == {"a", "b", "c"} and by["a"]["v"] == "srv"


def test_db_merge_pricing_only_when_changed():
    srv, inc = _db([], top=3600), _db([], top=3500)
    assert server.db_merge(srv, inc, False)["rates"]["stairPrice"]["topPrice"] == 3600
    assert server.db_merge(srv, inc, True)["rates"]["stairPrice"]["topPrice"] == 3500


def test_db_write_rejects_invalid_and_counts_rev(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(server, "DB_FILE", str(tmp_path / "db.json"))
    assert server.db_write({"db": {"users": []}})[0] == 400
    assert server.db_write({"db": _db([{"id": "a"}])})[1]["rev"] == 1
    code, rec = server.db_write({"db": _db([{"id": "b"}])})
    assert code == 200 and rec["rev"] == 2 and {c["id"] for c in rec["db"]["calculations"]} == {"a", "b"}
