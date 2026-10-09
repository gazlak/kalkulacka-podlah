"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { MailPreviewCard } from "@/components/auth/MailPreviewCard";
import { TopBar } from "@/components/chrome/TopBar";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet, SheetList } from "@/components/ui/Sheet";
import { Seg } from "@/components/ui/Seg";
import { initials, statusLabel } from "@/components/ui/misc";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import type { MailPreview } from "@/lib/api/client";
import { keys, useSession } from "@/lib/hooks";
import { fieldErrors, inviteSchema } from "@/lib/schemas";
import type { Role, User } from "@/lib/types";

export default function UsersPage() {
  const { data: me } = useSession();
  const qc = useQueryClient();
  const { toast } = useUi();
  const users = useQuery({ queryKey: keys.users, queryFn: () => api.users.list() });
  const [menuId, setMenuId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mail, setMail] = useState<MailPreview | null>(null);
  const [now] = useState(() => Date.now());

  const refresh = () => qc.invalidateQueries({ queryKey: keys.users });
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      setMenuId(null);
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const menuUser = users.data?.find((u) => u.id === menuId) ?? null;

  if (!me) return null;
  return (
    <>
      <TopBar title="Správa" />
      <AdminTabs />
      <div className="section-title">
        Uživatelé <button className="btn sm primary" onClick={() => setInviteOpen(true)}><Icon name="plus" />Pozvat</button>
      </div>
      <div className="list">
        {users.data?.map((u) => {
          const locked = !!u.lockedUntil && u.lockedUntil > now;
          return (
            <div className="lrow user-row" key={u.id}>
              <span className="lead">
                <span className="avatar">{initials(u)}</span>
                <div>
                  <b>{u.email}</b>
                  <span className="sub">{u.profile.name || "—"} · {u.profile.company || "—"}</span>
                  <div className="row" style={{ marginTop: 4, gap: 6 }}>
                    <span className={`badge st-${u.status}`}>{statusLabel(u.status)}</span>
                    {u.role === "admin" && <span className="badge st-koncept">Admin</span>}
                    {locked && <span className="badge st-blokován">zamčen po neúspěšných pokusech</span>}
                    {u.id === me.id && <span className="small muted">(vy)</span>}
                  </div>
                </div>
              </span>
              <button className="icon-btn" onClick={() => setMenuId(u.id)} aria-label={`Akce pro ${u.email}`}>
                <Icon name="more" size="lg" />
              </button>
            </div>
          );
        })}
      </div>

      <Sheet open={!!menuUser} onClose={() => setMenuId(null)}>
        {menuUser && (
          <UserMenu u={menuUser} now={now} self={menuUser.id === me.id}
            onRole={(r) => run(() => api.users.setRole(menuUser.id, r), `Role změněna: ${r === "admin" ? "admin" : "uživatel"}`)}
            onResend={async () => { setMenuId(null); setMail(await api.users.resendInvite(menuUser.id)); }}
            onUnblock={() => run(() => api.users.unblock(menuUser.id), "Uživatel odblokován")}
            onBlock={() => run(() => api.users.block(menuUser.id), "Uživatel zablokován")}
            onClose={() => setMenuId(null)} />
        )}
      </Sheet>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <InviteForm onCancel={() => setInviteOpen(false)} onDone={(m) => { setInviteOpen(false); setMail(m); refresh(); }} />
      </Sheet>

      <Sheet open={!!mail} onClose={() => { setMail(null); refresh(); }}>
        {mail && (
          <>
            <h2>Pozvánka vytvořena</h2>
            <p className="small muted">Demo: e-mail se neodesílá, zobrazujeme jeho náhled.</p>
            <MailPreviewCard mail={mail} />
            <div className="dlg-foot"><button className="btn" onClick={() => { setMail(null); refresh(); }}>Zavřít</button></div>
          </>
        )}
      </Sheet>
    </>
  );
}

function UserMenu({
  u, now, self, onRole, onResend, onUnblock, onBlock, onClose,
}: {
  u: User; now: number; self: boolean;
  onRole: (r: Role) => void; onResend: () => void; onUnblock: () => void; onBlock: () => void; onClose: () => void;
}) {
  const locked = !!u.lockedUntil && u.lockedUntil > now;
  const row = (icon: IconName, label: string, fn: () => void, danger?: boolean) => (
    <button type="button" className="lrow" onClick={fn}>
      <span className="lead" style={danger ? { color: "var(--bad)" } : undefined}><Icon name={icon} /><span className="k">{label}</span></span>
    </button>
  );
  const hasRows = u.status === "pozván" || u.status === "blokován" || locked || (u.status === "aktivní" && !self);
  return (
    <>
      <h2>{u.email}</h2>
      <div className="lbl">Role</div>
      <Seg<Role> full label="Role" value={u.role} disabled={self} onChange={onRole}
        options={[{ value: "user", label: "Uživatel" }, { value: "admin", label: "Admin" }]} />
      {self && <p className="small muted mt-2">Vlastní roli změnit nelze.</p>}
      {hasRows && (
        <SheetList>
          {u.status === "pozván" && row("mail", "Znovu poslat pozvánku", onResend)}
          {(u.status === "blokován" || locked) && row("key", "Odblokovat", onUnblock)}
          {u.status === "aktivní" && !self && row("x", "Blokovat", onBlock, true)}
        </SheetList>
      )}
      <div className="dlg-foot"><button className="btn" onClick={onClose}>Zavřít</button></div>
    </>
  );
}

function InviteForm({ onCancel, onDone }: { onCancel: () => void; onDone: (m: MailPreview) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = inviteSchema.safeParse({ email, role });
    if (!r.success) return setErrors(fieldErrors(r.error));
    try {
      const res = await api.users.invite(r.data.email, r.data.role);
      onDone(res.mail);
    } catch (err) {
      setErrors({ email: (err as Error).message });
    }
  }

  return (
    <>
      <h2>Pozvat uživatele</h2>
      <p className="small muted">Registrace je možná jen na pozvání.</p>
      <form onSubmit={submit} noValidate>
        <Field label="E-mail" htmlFor="ie" error={errors.email}>
          <Input type="email" id="ie" name="email" inputMode="email" autoCapitalize="none" value={email} error={errors.email}
            onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="ir">
          <Select id="ir" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="user">Uživatel (podlahář)</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div className="dlg-foot">
          <button type="button" className="btn" onClick={onCancel}>Zrušit</button>
          <button className="btn primary" type="submit">Vytvořit pozvánku</button>
        </div>
      </form>
    </>
  );
}
