"use client";
import { useState } from "react";
import { api, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { remove, type StaffMember } from "./InstitutionView";

/** One-time password reveal, shared with the platform admin page. */
export function NewAccountNotice({ email, tempPassword, onDone }: { email: string; tempPassword: string; onDone: () => void }) {
  return (
    <div className="card panel" style={{ background: "color-mix(in oklab, var(--mint) 18%, var(--surface))" }}>
      <h3 className="h-card">Account created for {email}</h3>
      <p className="small" style={{ margin: 0 }}>
        Send them this one-time password privately (not by public chat or email thread). It’s shown <b>only once</b>. They should sign in and change it from <b>Account</b>.
      </p>
      <div className="secret">{tempPassword}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(tempPassword).then(() => toast("Copied"))}>Copy</button>
        <button className="btn btn-primary btn-sm" onClick={onDone}>I’ve sent it</button>
      </div>
    </div>
  );
}

export function StaffPanel({ staff, meId, reload }: { staff: StaffMember[]; meId: string; reload: () => void }) {
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel-grid">
      {created ? <NewAccountNotice {...created} onDone={() => setCreated(null)} /> : (
        <form className="card panel" onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          setBusy(true);
          try {
            const r = await api<{ email: string; tempPassword: string }>("/institution/staff", {
              method: "POST", json: { name: String(f.get("name")).trim(), email: String(f.get("email")).trim(), staffRole: f.get("staffRole") },
            });
            form.reset(); setCreated(r); reload();
          } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
        }}>
          <h3 className="h-card">Add staff</h3>
          <div className="field"><label htmlFor="s-name">Full name</label><input className="input" id="s-name" name="name" required minLength={2} maxLength={80} /></div>
          <div className="field"><label htmlFor="s-email">Work email</label><input className="input" id="s-email" name="email" type="email" required /></div>
          <div className="field"><label htmlFor="s-role">Role</label>
            <select className="select" id="s-role" name="staffRole" defaultValue="LECTURER">
              <option value="LECTURER">Lecturer: notices, events, clubs, courses, grades</option>
              <option value="ADMIN">Admin: also verifies students and manages staff</option>
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
      )}
      <div className="card panel">
        <h3 className="h-card">{staff.length} staff</h3>
        {staff.map((s) => (
          <div key={s.id} className="list-row">
            <div><b>{s.name}</b>{s.id === meId && <span className="tiny"> (you)</span>}<div className="meta">{s.email} · {s.staffRole === "ADMIN" ? "Admin" : "Lecturer"} · since {fmtDate(s.createdAt)}</div></div>
            {s.id !== meId && <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/staff/${s.id}`, `${s.name}’s access (they’ll be signed out)`, reload)}>Remove</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
