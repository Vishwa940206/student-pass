"use client";
import { useCallback, useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { NewAccountNotice } from "@/app/institution/StaffPanel";

interface Inst { id: string; name: string; shortName: string }
interface Row { id: string; name: string; email: string; staffRole: "ADMIN" | "LECTURER"; institution: Inst }

/** Platform admin: give an institution its first admin account. */
export function InstitutionAccounts() {
  const [insts, setInsts] = useState<Inst[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ staff: Row[] }>("/admin/institution-staff").then((r) => setRows(r.staff)).catch(() => setRows(null));
  }, []);
  useEffect(() => {
    load();
    api<{ institutions: Inst[] }>("/institutions").then((r) => setInsts(r.institutions)).catch(() => {});
  }, [load]);

  if (rows === null) return null; // not a platform admin (the verification card already explains)

  return (
    <div style={{ marginTop: 28 }}>
      <div className="sec-head"><div className="l"><span className="eyebrow">Institutions</span><h2 className="h-sec">Institution accounts.</h2></div>
        <p className="r">Create each institution’s first admin. They add their own lecturers and verify their own students.</p></div>
      <div className="panel-grid">
        {created ? <NewAccountNotice {...created} onDone={() => setCreated(null)} /> : (
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            setBusy(true);
            try {
              const r = await api<{ email: string; tempPassword: string }>("/admin/institution-staff", {
                method: "POST",
                json: { institutionId: f.get("institutionId"), name: String(f.get("name")).trim(), email: String(f.get("email")).trim(), staffRole: "ADMIN" },
              });
              form.reset(); setCreated(r); load();
            } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
          }}>
            <h3 className="h-card">New institution admin</h3>
            <div className="field"><label htmlFor="ia-inst">Institution</label>
              <select className="select" id="ia-inst" name="institutionId" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {insts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="ia-name">Full name</label><input className="input" id="ia-name" name="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label htmlFor="ia-email">Work email</label><input className="input" id="ia-email" name="email" type="email" required /></div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create admin account"}</button>
          </form>
        )}
        <div className="card panel">
          <h3 className="h-card">{rows.length} staff accounts</h3>
          {rows.map((r) => (
            <div key={r.id} className="list-row">
              <div><b>{r.name}</b><div className="meta">{r.email} · {r.staffRole === "ADMIN" ? "Admin" : "Lecturer"}</div></div>
              <span className="tag soft">{r.institution.shortName}</span>
            </div>
          ))}
          {!rows.length && <p className="muted small" style={{ margin: 0 }}>No institution accounts yet.</p>}
        </div>
      </div>
    </div>
  );
}
