"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, toast } from "@/lib/client";

interface Pending {
  id: string; studentNumber: string; programme: string | null; createdAt: string;
  user: { name: string; email: string };
  institution: { name: string; shortName: string };
}

/** Default validity: end of the next June (typical academic year end). */
function defaultValidUntil() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-06-30`;
}

export function VerificationQueue() {
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [validUntil, setValidUntil] = useState(""); // empty = default (computed on click, not during prerender)
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ pending: Pending[] }>("/admin/verifications")
      .then((r) => setRows(r.pending))
      .catch((e) => { if (e instanceof ApiFailure && (e.status === 401 || e.status === 403)) setDenied(true); });
  }, []);
  useEffect(load, [load]);

  async function decide(p: Pending, decision: "VERIFIED" | "REJECTED") {
    if (decision === "REJECTED" && !window.confirm(`Reject ${p.user.name}?`)) return;
    setBusy(p.id);
    try {
      await api(`/admin/verifications/${p.id}`, { method: "POST", json: decision === "VERIFIED" ? { decision, validUntil: validUntil || defaultValidUntil() } : { decision } });
      toast(decision === "VERIFIED" ? `${p.user.name} verified` : `${p.user.name} rejected`);
      setRows((xs) => xs!.filter((x) => x.id !== p.id));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (denied) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 560 }}>
        <h3 className="h-card">Admins only</h3>
        <p className="muted">Sign in with an admin account to review verifications.</p>
        <Link className="btn btn-primary" href="/login">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <h3 className="h-card">{rows ? `${rows.length} waiting` : "Loading…"}</h3>
        <div className="field">
          <label htmlFor="vu">Approve as valid until (blank = 30 June)</label>
          <input className="input" id="vu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      {rows?.map((p) => (
        <div key={p.id} className="queue-row">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span className="tag" style={{ background: "var(--cyan)" }}>{p.institution.shortName}</span>
            <div>
              <b>{p.user.name}</b>
              <div className="tiny">{p.user.email} · {p.studentNumber}{p.programme ? ` · ${p.programme}` : ""} · {p.institution.name}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => decide(p, "REJECTED")}>Reject</button>
            <button className="btn btn-mint btn-sm" disabled={busy === p.id} onClick={() => decide(p, "VERIFIED")}>Verify</button>
          </div>
        </div>
      ))}
      {rows && !rows.length && <p className="muted" style={{ marginBottom: 0 }}>Nothing waiting. All caught up.</p>}
    </div>
  );
}
