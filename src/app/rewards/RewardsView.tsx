"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";

interface Data {
  balance: number; lifetime: number;
  tier: { name: string; next: { name: string; at: number } | null };
  rules: { WELCOME: number; OFFER_REDEEMED: number; FEE_PER_1000_LKR: number; FEE_MAX: number; SHOP_PER_100_LKR: number };
  history: { id: string; delta: number; reason: string; note: string; createdAt: string }[];
  rewards: { id: string; title: string; description: string; cost: number; stock: number | null }[];
  mine: { id: string; code: string; cost: number; status: string; createdAt: string; reward: { title: string } }[];
}
const TIER_FLOOR: Record<string, number> = { Mint: 0, Green: 1500, Black: 4000 };

export function RewardsView() {
  const [d, setD] = useState<Data | null>(null);
  const [blocked, setBlocked] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { api<Data>("/rewards").then(setD).catch((e) => setBlocked(e as ApiFailure)); }, []);
  useEffect(load, [load]);

  if (blocked) return (
    <div className="card" style={{ padding: 32, maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="h-card">{blocked.status === 401 ? "Sign in to see your points" : "Pass Points start once you’re verified"}</h2>
      <p className="muted" style={{ margin: 0 }}>{blocked.status === 401 ? "Earn points with your Student Pass and spend them on rewards." : blocked.message}</p>
      <div style={{ display: "flex", gap: 10 }}>{blocked.status === 401 ? <><Link className="btn btn-primary" href="/login">Sign in</Link><Link className="btn btn-ghost" href="/signup">Get Student Pass</Link></> : <Link className="btn btn-primary" href="/pass">My Pass</Link>}</div>
    </div>
  );
  if (!d) return <p className="muted">Loading your points…</p>;
  const floor = TIER_FLOOR[d.tier.name] ?? 0;
  const pct = d.tier.next ? Math.min(100, Math.round(((d.lifetime - floor) / (d.tier.next.at - floor)) * 100)) : 100;

  async function redeem(id: string, title: string, cost: number) {
    if (!window.confirm(`Spend ${cost.toLocaleString()} points on “${title}”?`)) return;
    setBusy(id);
    try { const r = await api<{ code: string }>(`/rewards/${id}/redeem`, { method: "POST" }); toast(`Done. Your code is ${r.code}`); load(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      <div className="duo" style={{ marginBottom: 18 }}>
        <div className="card panel">
          <span className="eyebrow">Pass Points · {d.tier.name} tier</span>
          <b className="big-num">{d.balance.toLocaleString()}</b>
          <div className="tier"><i style={{ width: `${pct}%` }} /></div>
          <span className="tiny">{d.tier.next ? `${(d.tier.next.at - d.lifetime).toLocaleString()} points to ${d.tier.next.name}` : "Top tier"}</span>
        </div>
        <div className="card panel">
          <span className="eyebrow">How to earn</span>
          <div className="list-row"><span>Redeem an offer at the till</span><b>+{d.rules.OFFER_REDEEMED}</b></div>
          <div className="list-row"><span>Pay a fee (per LKR 1,000)</span><b>+{d.rules.FEE_PER_1000_LKR}</b></div>
          <div className="list-row"><span>Collect a shop order (per LKR 100)</span><b>+{d.rules.SHOP_PER_100_LKR}</b></div>
          <div className="list-row"><span>Get verified</span><b>+{d.rules.WELCOME}</b></div>
        </div>
      </div>
      <div className="panel-grid">
        <div className="card panel">
          <h3 className="h-card">Spend your points</h3>
          {d.rewards.map((r) => (
            <div key={r.id} className="list-row">
              <div><b>{r.title}</b>{r.description && <div className="meta">{r.description}</div>}{r.stock !== null && <div className="meta">{r.stock} left</div>}</div>
              <button className="btn btn-mint btn-sm" disabled={busy === r.id || d.balance < r.cost || r.stock === 0} onClick={() => redeem(r.id, r.title, r.cost)}>
                {r.stock === 0 ? "Gone" : `${r.cost.toLocaleString()} pts`}
              </button>
            </div>
          ))}
          {!d.rewards.length && <p className="muted small" style={{ margin: 0 }}>Rewards are on their way.</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {d.mine.length > 0 && (
            <div className="card panel">
              <h3 className="h-card">My rewards</h3>
              {d.mine.map((m) => (
                <div key={m.id} className="list-row"><div><b>{m.reward.title}</b><div className="meta">{fmtDate(m.createdAt)} · {m.cost.toLocaleString()} pts</div></div>
                  <span className="secret" style={{ fontSize: 15, padding: "6px 10px", opacity: m.status === "ISSUED" ? 1 : 0.5 }}>{m.code}</span></div>
              ))}
            </div>
          )}
          <div className="card panel">
            <h3 className="h-card">History</h3>
            {d.history.map((h) => (
              <div key={h.id} className="list-row"><div><span>{h.note}</span><div className="meta">{fmtDate(h.createdAt)}</div></div><b style={{ color: h.delta > 0 ? "var(--g-ink)" : undefined }}>{h.delta > 0 ? "+" : ""}{h.delta.toLocaleString()}</b></div>
            ))}
            {!d.history.length && <p className="muted small" style={{ margin: 0 }}>No points yet. Redeem an offer to start.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
