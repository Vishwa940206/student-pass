"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fetchMe, toast, type Me } from "@/lib/client";

export function PasswordForm() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchMe().then(setMe).catch(() => setMe(null)); }, []);

  if (me === undefined) return <p className="muted">Loading…</p>;
  if (!me) return <div className="card auth-card"><p className="muted" style={{ margin: 0 }}>Sign in to manage your account.</p><Link className="btn btn-primary" href="/login">Sign in</Link></div>;

  return (
    <form className="card auth-card" style={{ margin: 0 }} onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget; const f = new FormData(form);
      if (f.get("newPassword") !== f.get("confirm")) return setError("The new passwords don’t match");
      setBusy(true); setError(null);
      try {
        await api("/auth/password", { method: "POST", json: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
        form.reset();
        toast("Password changed. Other devices were signed out");
      } catch (err) {
        setError((err as Error).message);
      } finally { setBusy(false); }
    }}>
      <div>
        <b>{me.user.name}</b>
        <div className="tiny">{me.user.email}{me.staff ? ` · ${me.staff.institution.name}` : me.student ? ` · ${me.student.institution.shortName}` : ""}</div>
      </div>
      <h3 className="h-card" style={{ margin: 0 }}>Change password</h3>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="cur">Current password</label><input className="input" id="cur" name="currentPassword" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="np">New password (10+ characters)</label><input className="input" id="np" name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div className="field"><label htmlFor="cp">Repeat new password</label><input className="input" id="cp" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></div>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <span className="spinner" /> : "Change password"}</button>
    </form>
  );
}
