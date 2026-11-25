"use client";
import { useState } from "react";
import { api, ApiFailure } from "@/lib/client";
import { SERVICE_GROUPS, STUDENT_BANDS } from "@/lib/os/services";

export function ProposalForm() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (sent) return <div className="card panel"><h2 className="h-card">Thanks, we’ll be in touch.</h2><p style={{ margin: 0 }}>Our team will reply with pricing for your selection.</p></div>;
  return (
    <>
      <div className="board" style={{ marginBottom: 16 }}>
        {SERVICE_GROUPS.map(([group, items]) => (
          <div key={group} className="board-col">
            <b className="small">{group}</b>
            {items.map(([id, name, unit]) => (
              <button key={id} type="button" className={`card board-card svc${picked.has(id) ? " on" : ""}`} onClick={() => toggle(id)} aria-pressed={picked.has(id)}>
                <b>{name}</b><span className="meta">Quoted {unit}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <form className="card panel" noValidate onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
        if (!picked.size) return setError("Pick at least one service above");
        setBusy(true); setError(null);
        try {
          await api("/public/proposals", { method: "POST", json: { institutionName: v("inst"), contactName: v("name"), email: v("email"), studentsBand: v("band") || undefined, notes: v("notes") || undefined, items: [...picked], website: v("website") } });
          setSent(true);
        } catch (err) { const fe = err as ApiFailure; setError(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); } finally { setBusy(false); }
      }}>
        <h2 className="h-card">Request a proposal · {picked.size} selected</h2>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <div className="field"><label htmlFor="p-inst">Institution</label><input className="input" id="p-inst" name="inst" required /></div>
          <div className="field"><label htmlFor="p-band">Students (approx.)</label><select className="select" id="p-band" name="band" defaultValue=""><option value="">—</option>{STUDENT_BANDS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="field"><label htmlFor="p-name">Your name</label><input className="input" id="p-name" name="name" required autoComplete="name" /></div>
          <div className="field"><label htmlFor="p-email">Work email</label><input className="input" id="p-email" name="email" type="email" required autoComplete="email" /></div>
          <div className="field full"><label htmlFor="p-notes">Anything else</label><textarea className="input" id="p-notes" name="notes" maxLength={2000} /></div>
          <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}><label htmlFor="p-web">Website</label><input id="p-web" name="website" tabIndex={-1} autoComplete="off" /></div>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Request proposal"}</button>
      </form>
    </>
  );
}
