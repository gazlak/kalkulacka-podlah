import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { acceptInvite, checkToken, login, requestReset, resetPassword, userBySession } from "./auth";
import { draftCalc, duplicateCalc, finalizeCalc, getCalc, listCalcs, recalcCalc, saveCalc, sendCalc, setCalcStatus } from "./calculations";
import { storeDataUrl } from "./files";
import { currentPricing, updateRates } from "./pricing";
import { blockUser, deleteUser, inviteUser, lookupUser, updateProfile } from "./users";
import { testCtx } from "../test-helpers";

type T = Awaited<ReturnType<typeof testCtx>>;
let t: T;
beforeAll(async () => { t = await testCtx(); }, 60_000);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function newCalc(owner: Awaited<ReturnType<T["actor"]>>) {
  const d = await draftCalc(t.db, owner);
  return saveCalc(t.db, owner, { ...d, job: { ...d.job, name: "Test" }, patternId: 1 });
}

describe("číslování a snapshot ceníku", () => {
  it("přidělí další číslo za seedem a snapshot; opakované uložení číslo nemění", async () => {
    const novak = await t.actor("novak@demo.cz");
    const c = await newCalc(novak);
    expect(c.number).toBeNull();
    const f = await finalizeCalc(t.db, novak, c.id);
    expect(f.number).toBe("2026-0042");
    expect(f.snapshot?.patterns).toHaveLength(6);
    expect((await finalizeCalc(t.db, novak, c.id)).number).toBe("2026-0042");
  });

  it("souběžné finalize dají unikátní čísla", async () => {
    const svoboda = await t.actor("svoboda@demo.cz");
    const cs = await Promise.all([newCalc(svoboda), newCalc(svoboda), newCalc(svoboda)]);
    const nums = (await Promise.all(cs.map((c) => finalizeCalc(t.db, svoboda, c.id)))).map((c) => c.number);
    expect(new Set(nums).size).toBe(3);
  });

  it("změna ceníku se projeví jen po recalc", async () => {
    const admin = await t.actor("admin@demo.cz");
    const novak = await t.actor("novak@demo.cz");
    const c = await finalizeCalc(t.db, novak, (await newCalc(novak)).id);
    const rates = (await currentPricing(t.db)).rates;
    await updateRates(t.db, { ...rates, transport: 2000 });
    expect((await getCalc(t.db, novak, c.id))!.snapshot!.rates.transport).toBe(1500);
    expect((await recalcCalc(t.db, novak, c.id)).snapshot!.rates.transport).toBe(2000);
    void admin;
  });
});

describe("autorizace", () => {
  it("podlahář nevidí cizí kalkulace, admin vidí všechny", async () => {
    const novak = await t.actor("novak@demo.cz");
    const admin = await t.actor("admin@demo.cz");
    const own = await listCalcs(t.db, novak);
    expect(own.every((c) => c.ownerId === novak.id)).toBe(true);
    expect((await listCalcs(t.db, admin)).length).toBeGreaterThan(own.length);
    const foreign = (await listCalcs(t.db, admin)).find((c) => c.ownerId !== novak.id)!;
    expect(await getCalc(t.db, novak, foreign.id)).toBeNull();
  });

  it("admin cizí kalkulaci jen čte (zápis 403), může ji duplikovat", async () => {
    const novak = await t.actor("novak@demo.cz");
    const admin = await t.actor("admin@demo.cz");
    const c = await newCalc(novak);
    await expect(saveCalc(t.db, admin, c)).rejects.toMatchObject({ status: 403 });
    await expect(finalizeCalc(t.db, admin, c.id)).rejects.toMatchObject({ status: 403 });
    await expect(setCalcStatus(t.db, admin, c.id, "přijato")).rejects.toMatchObject({ status: 403 });
    const copy = await duplicateCalc(t.db, admin, c.id);
    expect(copy.ownerId).toBe(admin.id);
    expect(copy.number).toBeNull();
  });

  it("cizí uživatel nemůže přepsat kalkulaci přes shodné id", async () => {
    const novak = await t.actor("novak@demo.cz");
    const svoboda = await t.actor("svoboda@demo.cz");
    const c = await newCalc(novak);
    await expect(saveCalc(t.db, svoboda, c)).rejects.toMatchObject({ status: 403 });
    await expect(finalizeCalc(t.db, svoboda, c.id)).rejects.toMatchObject({ status: 404 });
  });

  it("lookup cizího uživatele smí jen admin", async () => {
    const novak = await t.actor("novak@demo.cz");
    const admin = await t.actor("admin@demo.cz");
    expect(await lookupUser(t.db, novak, admin.id)).toBeNull();
    expect((await lookupUser(t.db, admin, novak.id))?.email).toBe("novak@demo.cz");
  });
});

describe("přihlášení a blokace", () => {
  it("5 chybných pokusů zamkne účet na 15 min, správné heslo pak neprojde", async () => {
    let last;
    for (let i = 0; i < 5; i++) last = (await login(t.db, { email: "svoboda@demo.cz", password: "x", remember: false })).result;
    expect(last).toMatchObject({ ok: false, error: "locked" });
    const r = await login(t.db, { email: "svoboda@demo.cz", password: "heslo1234", remember: false });
    expect(r.result).toMatchObject({ ok: false, error: "locked" });
    await t.db.update(users).set({ lockedUntil: null }).where(eq(users.email, "svoboda@demo.cz"));
    expect((await login(t.db, { email: "svoboda@demo.cz", password: "heslo1234", remember: false })).result.ok).toBe(true);
  });

  it("relace: remember = delší platnost; zablokování relaci zruší", async () => {
    const a = await login(t.db, { email: "novak@demo.cz", password: "heslo1234", remember: true });
    const b = await login(t.db, { email: "novak@demo.cz", password: "heslo1234", remember: false });
    expect(a.session!.expiresAt.getTime()).toBeGreaterThan(b.session!.expiresAt.getTime());
    expect((await userBySession(t.db, a.session!.token))?.email).toBe("novak@demo.cz");
    const admin = await t.actor("admin@demo.cz");
    await blockUser(t.db, admin, (await userBySession(t.db, a.session!.token))!.id);
    expect(await userBySession(t.db, a.session!.token)).toBeNull();
    expect((await login(t.db, { email: "novak@demo.cz", password: "heslo1234", remember: false })).result).toMatchObject({ ok: false });
  });

  it("neexistující účet = stejná chyba jako špatné heslo", async () => {
    const r = await login(t.db, { email: "nikdo@demo.cz", password: "x", remember: false });
    expect(r.result).toEqual({ ok: false, error: "Nesprávný e-mail nebo heslo." });
  });
});

describe("reset hesla a pozvánky", () => {
  const link = (body: string) => /\/(?:reset|invite)\/([\w-]+)/.exec(body)![1];

  it("forgot: neexistující účet nic neposílá; token je jednorázový", async () => {
    const before = t.mailer.sent.length;
    await requestReset(t, "nikdo@demo.cz");
    expect(t.mailer.sent.length).toBe(before);
    await requestReset(t, "svoboda@demo.cz");
    await new Promise((r) => setTimeout(r, 50));
    const token = link(t.mailer.sent.at(-1)!.text);
    expect(await checkToken(t.db, token, "reset")).toMatchObject({ ok: true, email: "svoboda@demo.cz" });
    await expect(resetPassword(t.db, token, "krátké")).rejects.toMatchObject({ status: 400 });
    await resetPassword(t.db, token, "noveHeslo123");
    await expect(resetPassword(t.db, token, "dalsiHeslo123")).rejects.toMatchObject({ status: 400 });
    expect((await login(t.db, { email: "svoboda@demo.cz", password: "noveHeslo123", remember: false })).result.ok).toBe(true);
  });

  it("pozvánka: uživatel se nepřihlásí před dokončením, pak ano", async () => {
    const admin = await t.actor("admin@demo.cz");
    const { user } = await inviteUser(t, "Nova@Firma.cz", "user");
    expect(user.status).toBe("pozván");
    await expect(inviteUser(t, "nova@firma.cz", "user")).rejects.toMatchObject({ status: 400 });
    const token = link(t.mailer.sent.at(-1)!.text);
    expect((await login(t.db, { email: "nova@firma.cz", password: "", remember: false })).result.ok).toBe(false);
    await acceptInvite(t.db, token, "heslo12345", "Nový Člověk");
    const r = await login(t.db, { email: "nova@firma.cz", password: "heslo12345", remember: false });
    expect(r.result).toMatchObject({ ok: true, user: { profile: { name: "Nový Člověk" } } });
    await deleteUser(t.db, admin, user.id);
    expect(await lookupUser(t.db, admin, user.id)).toBeNull();
  });
});

describe("obrázky a odeslání", () => {
  it("přijme PNG, odmítne SVG a falešný obsah", async () => {
    await expect(storeDataUrl(t.db, "data:image/svg+xml;base64,PHN2Zy8+")).rejects.toMatchObject({ status: 400 });
    await expect(storeDataUrl(t.db, "data:image/png;base64,AAAA")).rejects.toMatchObject({ status: 400 });
    const novak = await t.actor("novak@demo.cz");
    const u = await updateProfile(t.db, novak, { name: "J", company: "", ico: "", phone: "", logo: PNG });
    expect(u.profile.logo).toMatch(/^\/api\/files\/[0-9a-f]{64}$/);
    // stejná URL zpět = beze změny
    expect((await updateProfile(t.db, novak, { ...u.profile, logo: u.profile.logo })).profile.logo).toBe(u.profile.logo);
  });

  it("send: nastaví stav a příjemce, přiloží PDF; nezapsané číslo odmítne", async () => {
    const novak = await t.actor("novak@demo.cz");
    const c = await newCalc(novak);
    const mail = { to: "z@example.cz", subject: "Kalkulace", body: "Dobrý den" };
    await expect(sendCalc(t, novak, c.id, mail)).rejects.toMatchObject({ status: 400 });
    const f = await finalizeCalc(t.db, novak, c.id);
    const s = await sendCalc(t, novak, f.id, mail);
    expect(s).toMatchObject({ status: "odesláno", sentTo: "z@example.cz" });
    expect(t.mailer.sent.at(-1)!.attachments![0].filename).toBe(`kalkulace-${f.number}.pdf`);
  });
});
