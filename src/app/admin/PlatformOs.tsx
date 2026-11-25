"use client";
import { useCallback, useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { fmtDateTime } from "@/lib/format";
import { MODULES } from "@/lib/os/modules";
import { serviceName } from "@/lib/os/services";

interface Inst { id: string; name: string; shortName: string; modules: string[]; staff: number; students: number; leads: number }
interface Req { id: string; institutionName: string; contactName: string; email: string; studentsBand: string | null; items: string[]; notes: string | null; status: string; createdAt: string; institutionId: string | null }

/** Platform admin: proposal requests (B2B pipeline) and module licensing per institution. */
export function PlatformOs() {
  const [insts, setInsts] = useState<Inst[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [filter, setFilter] = useState("");
  const load = useCallback(() => {
    api<{ institutions: Inst[] }>("/admin/institutions").then((r) => setInsts(r.institutions)).catch(() => setInsts(null));
    api<{ requests: Req[] }>("/admin/proposals").then((r) => setReqs(r.requests)).catch(() => {});
  }, []);
  useEffect(load, [load]);
  if (!insts) return null;

  async function toggle(i: Inst, mod: string) {
    const modules = i.modules.includes(mod) ? i.modules.filter((m) => m !== mod) : [...i.modules, mod];
    try { await api(`/admin/institutions/${i.id}/modules`, { method: "PUT", json: { modules } }); setInsts((xs) => xs!.map((x) => (x.id === i.id ? { ...x, modules } : x))); }
    catch (e) { toast((e as Error).message); }
  }

  const shown = insts.filter((i) => !filter || `${i.name} ${i.shortName}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sec-head"><div className="l"><span className="eyebrow">B2B</span><h2 className="h-sec">Proposals and licences.</h2></div></div>
      <div className="card panel">
        <h3 className="h-card">{(() => { const n = reqs.filter((r) => r.status === "NEW").length; return `${n} new proposal ${n === 1 ? "request" : "requests"}`; })()}</h3>
        {reqs.map((r) => (
          <div key={r.id} className="list-row">
            <div><b>{r.institutionName}</b> <span className="tiny">{r.institutionId ? "on Student Pass" : "new institution"}</span>
              <div className="meta">{r.items.map(serviceName).join(", ")}</div>
              <div className="meta">{r.contactName} · <a href={`mailto:${r.email}`}>{r.email}</a>{r.studentsBand ? ` · ${r.studentsBand} students` : ""} · {fmtDateTime(r.createdAt)}</div>
              {r.notes && <div className="meta">“{r.notes}”</div>}</div>
            <select className="select" value={r.status} aria-label="Status" style={{ maxWidth: 150 }} onChange={async (e) => {
              const status = e.target.value;
              try { await api(`/admin/proposals/${r.id}`, { method: "PATCH", json: { status } }); setReqs((xs) => xs.map((x) => (x.id === r.id ? { ...x, status } : x))); } catch (err) { toast((err as Error).message); }
            }}>{["NEW", "CONTACTED", "WON", "LOST"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select>
          </div>
        ))}
        {!reqs.length && <p className="muted small" style={{ margin: 0 }}>No requests yet.</p>}
      </div>
      <details className="card panel">
        <summary style={{ cursor: "pointer" }}><b className="h-card">Institution OS licences</b> <span className="tiny">· {insts.length} institutions · click to manage</span></summary>
        <div className="row" style={{ marginTop: 12 }}><span /><input className="input" placeholder="Filter institutions" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 240 }} aria-label="Filter institutions" /></div>
        <div style={{ overflowX: "auto" }}>
          <table className="gradebook">
            <thead><tr><th>Institution</th>{MODULES.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
            <tbody>{shown.map((i) => (
              <tr key={i.id}><td><b>{i.shortName}</b><div className="tiny">{i.staff} staff · {i.students} students · {i.leads} leads</div></td>
                {MODULES.map(([k, l]) => <td key={k}><input type="checkbox" checked={i.modules.includes(k)} onChange={() => toggle(i, k)} aria-label={`${l} for ${i.shortName}`} /></td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
