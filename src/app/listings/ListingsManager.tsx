"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, fetchMe, toast, type Me } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { DISTRICTS } from "@/lib/os/labels";

interface Listing {
  id: string; kind: "JOB" | "HOUSING"; title: string; organisation: string; district: string; pay: string; open: boolean; institutionId: string | null; createdAt: string;
  responses: { message: string; phone: string | null; createdAt: string; student: { user: { name: string; email: string }; institution: { shortName: string } } }[];
}

export function ListingsManager() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [denied, setDenied] = useState(false);
  const load = useCallback(() => { api<{ listings: Listing[] }>("/listings").then((r) => setRows(r.listings)).catch(() => setDenied(true)); }, []);
  useEffect(() => { load(); fetchMe().then(setMe).catch(() => {}); }, [load]);

  if (denied) return (
    <div className="card" style={{ padding: 32, maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="h-card">Partners only</h2>
      <p className="muted" style={{ margin: 0 }}>Sign in with a merchant, institution admin or Student Pass admin account to post listings.</p>
      <Link className="btn btn-primary" href="/login" style={{ alignSelf: "flex-start" }}>Sign in</Link>
    </div>
  );
  if (!rows) return <p className="muted">Loading…</p>;
  const institution = me?.staff?.institution;

  return (
    <div className="panel-grid">
      <form className="card panel" onSubmit={async (e) => {
        e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const v = (k: string) => String(f.get(k) ?? "").trim();
        try {
          await api("/listings", { method: "POST", json: { kind: v("kind"), title: v("title"), organisation: v("org"), description: v("desc"), district: v("district"), pay: v("pay"), onlyMyStudents: f.get("only") === "on", expiresAt: v("expires") || null } });
          toast("Listing posted"); form.reset(); load();
        } catch (err) { const fe = err as ApiFailure; toast(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
      }}>
        <h3 className="h-card">New listing</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="l-k">Type</label><select className="select" id="l-k" name="kind"><option value="JOB">Job or internship</option><option value="HOUSING">Housing</option></select></div>
          <div className="field"><label htmlFor="l-d">District</label><select className="select" id="l-d" name="district" defaultValue="Colombo">{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div className="field full"><label htmlFor="l-t">Title</label><input className="input" id="l-t" name="title" required minLength={3} placeholder="Part-time barista" /></div>
          <div className="field"><label htmlFor="l-o">Employer / landlord</label><input className="input" id="l-o" name="org" required minLength={2} /></div>
          <div className="field"><label htmlFor="l-p">Pay or rent</label><input className="input" id="l-p" name="pay" required placeholder="LKR 1,200 / hour" /></div>
          <div className="field full"><label htmlFor="l-desc">Details</label><textarea className="input" id="l-desc" name="desc" required minLength={10} /></div>
          <div className="field"><label htmlFor="l-e">Closes on (optional)</label><input className="input" id="l-e" name="expires" type="date" /></div>
          {institution && <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="only" /> Only {institution.shortName} students</label>}
        </div>
        <button className="btn btn-primary">Post listing</button>
      </form>
      <div className="card panel">
        <h3 className="h-card">{rows.length} listings</h3>
        {rows.map((l) => (
          <details key={l.id} className="list-row" style={{ display: "block" }}>
            <summary style={{ display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
              <span><b>{l.title}</b><span className="meta" style={{ display: "block" }}>{l.kind === "JOB" ? "Job" : "Housing"} · {l.organisation} · {l.district} · {fmtDate(l.createdAt)}{l.open ? "" : " · closed"}</span></span>
              <span className="tag soft">{l.responses.length} {l.kind === "JOB" ? "applications" : "enquiries"}</span>
            </summary>
            {l.responses.map((r, i) => (
              <div key={i} className="meta" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <b>{r.student.user.name}</b> · {r.student.institution.shortName} · <a href={`mailto:${r.student.user.email}`}>{r.student.user.email}</a>{r.phone ? ` · ${r.phone}` : ""}
                <div style={{ whiteSpace: "pre-line" }}>{r.message}</div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={async () => { try { await api(`/listings/${l.id}`, { method: "PATCH", json: { open: !l.open } }); load(); } catch (e) { toast((e as Error).message); } }}>{l.open ? "Close listing" : "Reopen"}</button>
          </details>
        ))}
        {!rows.length && <p className="muted small" style={{ margin: 0 }}>Nothing posted yet.</p>}
      </div>
    </div>
  );
}
