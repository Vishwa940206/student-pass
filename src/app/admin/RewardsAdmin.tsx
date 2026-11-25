"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, toast } from "@/lib/client";

interface Reward { id: string; title: string; description: string; cost: number; stock: number | null; active: boolean; redeemed: number }

/** Platform admin: the Pass Points rewards catalogue. */
export function RewardsAdmin() {
  const [rows, setRows] = useState<Reward[] | null>(null);
  const load = useCallback(() => { api<{ rewards: Reward[] }>("/admin/rewards").then((r) => setRows(r.rewards)).catch(() => setRows(null)); }, []);
  useEffect(load, [load]);
  if (!rows) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <div className="sec-head"><div className="l"><span className="eyebrow">Pass Points</span><h2 className="h-sec">Rewards catalogue.</h2></div>
        <p className="r">What students can spend points on. Also: <Link href="/listings">post jobs &amp; housing</Link>.</p></div>
      <div className="panel-grid">
        <form className="card panel" onSubmit={async (e) => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const v = (k: string) => String(f.get(k) ?? "").trim();
          try {
            await api("/admin/rewards", { method: "POST", json: { title: v("title"), description: v("desc"), cost: Number(v("cost")), stock: v("stock") ? Number(v("stock")) : null } });
            toast("Reward added"); form.reset(); load();
          } catch (err) { const fe = err as ApiFailure; toast(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
        }}>
          <h3 className="h-card">Add a reward</h3>
          <div className="form-grid">
            <div className="field full"><label htmlFor="rw-t">Reward</label><input className="input" id="rw-t" name="title" required minLength={2} placeholder="Free regular coffee" /></div>
            <div className="field"><label htmlFor="rw-c">Cost (points)</label><input className="input" id="rw-c" name="cost" type="number" min={1} required /></div>
            <div className="field"><label htmlFor="rw-s">Stock (blank = no limit)</label><input className="input" id="rw-s" name="stock" type="number" min={0} /></div>
            <div className="field full"><label htmlFor="rw-d">How to use it</label><input className="input" id="rw-d" name="desc" maxLength={1000} placeholder="Show the code at the counter." /></div>
          </div>
          <button className="btn btn-primary">Add reward</button>
        </form>
        <div className="card panel">
          <h3 className="h-card">{rows.length} rewards</h3>
          {rows.map((r) => (
            <div key={r.id} className="list-row">
              <div><b>{r.title}</b>{!r.active && <span className="tiny"> · retired</span>}<div className="meta">{r.cost.toLocaleString()} pts · {r.stock === null ? "no limit" : `${r.stock} left`} · {r.redeemed} redeemed</div></div>
              <button className="btn btn-ghost btn-sm" onClick={async () => { try { await api(`/admin/rewards/${r.id}`, { method: "PATCH", json: { active: !r.active } }); load(); } catch (e) { toast((e as Error).message); } }}>{r.active ? "Retire" : "Restore"}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
