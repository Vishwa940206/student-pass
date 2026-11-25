"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, formatLkr, toast } from "@/lib/client";
import { NewAccountNotice } from "@/app/institution/StaffPanel";
import { DISTRICTS } from "@/lib/os/labels";

interface Merchant {
  id: string; name: string; products: number; offers: number;
  locations: { id: string; code: string; name: string; district: string; inProgramme: boolean }[];
  staff: { name: string; email: string }[];
}
interface Offer {
  id: string; title: string; category: string; badge: string; benefit: string; howTo: string; channel: "IN_STORE" | "ONLINE";
  districts: string[]; status: string; externalUrl: string | null; discountType: "PERCENT" | "FIXED" | "SPONSORED" | null; discountValue: number | null;
  maxDiscountCents: number | null; minSpendCents: number | null; sponsorId: string | null; sponsorBudgetCents: number | null;
  limitPerWeek: number | null; limitPerYear: number | null; redemptions: number;
  merchant: { id: string; name: string } | null; sponsor: { id: string; shortName: string } | null;
}
interface Inst { id: string; name: string; shortName: string }

const errMsg = (e: unknown) => { const f = e as ApiFailure; return f.issues ? `${f.message}: ${Object.values(f.issues).flat()[0]}` : f.message; };
const cents = (v: string) => (v.trim() ? Math.round(Number(v.replace(/[^\d.]/g, "")) * 100) : null);
const int = (v: string) => (v.trim() ? Number(v) : null);

/** Platform admin: merchants (with branches and logins) and the offers catalogue. */
export function CatalogueAdmin() {
  const [merchants, setMerchants] = useState<Merchant[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [insts, setInsts] = useState<Inst[]>([]);
  const [login, setLogin] = useState<{ email: string; tempPassword: string } | null>(null);
  const [editing, setEditing] = useState<Offer | "new" | null>(null);

  const load = useCallback(() => {
    api<{ merchants: Merchant[] }>("/admin/merchants").then((r) => setMerchants(r.merchants)).catch(() => setMerchants(null));
    api<{ offers: Offer[]; categories: string[] }>("/admin/offers").then((r) => { setOffers(r.offers); setCats(r.categories); }).catch(() => {});
  }, []);
  useEffect(() => { load(); api<{ institutions: Inst[] }>("/institutions").then((r) => setInsts(r.institutions)).catch(() => {}); }, [load]);
  if (!merchants) return null;

  return (
    <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sec-head"><div className="l"><span className="eyebrow">Catalogue</span><h2 className="h-sec">Merchants and offers.</h2></div>
        <p className="r">Onboard a merchant with its branches and a till login. Their staff then list Student Shop products from <b>/pos</b>.</p></div>

      <div className="panel-grid">
        {login ? <NewAccountNotice {...login} onDone={() => setLogin(null)} /> : (
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const v = (k: string) => String(f.get(k) ?? "").trim();
            try {
              const r = await api<{ email: string; tempPassword: string }>("/admin/merchants", { method: "POST", json: {
                name: v("name"), branches: [{ code: v("code"), name: v("branch"), district: v("district") }], staff: { name: v("sname"), email: v("semail") },
              } });
              form.reset(); setLogin(r); load();
            } catch (er) { toast(errMsg(er)); }
          }}>
            <h3 className="h-card">New merchant</h3>
            <div className="form-grid">
              <div className="field full"><label htmlFor="m-n">Business name</label><input className="input" id="m-n" name="name" required minLength={2} /></div>
              <div className="field"><label htmlFor="m-b">First branch</label><input className="input" id="m-b" name="branch" required placeholder="Kollupitiya" /></div>
              <div className="field"><label htmlFor="m-c">Branch code</label><input className="input" id="m-c" name="code" required placeholder="KOL" maxLength={6} style={{ textTransform: "uppercase" }} /></div>
              <div className="field"><label htmlFor="m-d">District</label><select className="select" id="m-d" name="district" defaultValue="Colombo">{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div className="field" />
              <div className="field"><label htmlFor="m-sn">Staff name</label><input className="input" id="m-sn" name="sname" required minLength={2} /></div>
              <div className="field"><label htmlFor="m-se">Staff email (their login)</label><input className="input" id="m-se" name="semail" type="email" required /></div>
            </div>
            <button className="btn btn-primary">Create merchant</button>
          </form>
        )}
        <div className="card panel">
          <h3 className="h-card">{merchants.length} merchants</h3>
          {merchants.map((m) => (
            <details key={m.id} className="list-row" style={{ display: "block" }}>
              <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span><b>{m.name}</b><span className="meta" style={{ display: "block" }}>{m.locations.length} branches · {m.staff.length} staff · {m.products} products · {m.offers} offers</span></span>
              </summary>
              <div className="meta" style={{ marginTop: 8 }}>Branches: {m.locations.map((l) => `${l.code} ${l.name} (${l.district})`).join(" · ")}</div>
              <div className="meta">Staff: {m.staff.map((s) => `${s.name} <${s.email}>`).join(" · ") || "none"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  const name = window.prompt("Staff member’s name"); if (!name) return; const email = window.prompt("Their email (login)"); if (!email) return;
                  try { setLogin(await api(`/admin/merchants/${m.id}/staff`, { method: "POST", json: { name, email } })); load(); } catch (er) { toast(errMsg(er)); }
                }}>Add staff login</button>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  const name = window.prompt("Branch name"); if (!name) return; const code = window.prompt("Branch code (2–6 letters)"); if (!code) return;
                  const district = window.prompt("District", "Colombo"); if (!district) return;
                  try { await api(`/admin/merchants/${m.id}/locations`, { method: "POST", json: { name, code, district } }); toast("Branch added"); load(); } catch (er) { toast(errMsg(er)); }
                }}>Add branch</button>
              </div>
            </details>
          ))}
          {!merchants.length && <p className="muted small" style={{ margin: 0 }}>No merchants yet.</p>}
        </div>
      </div>

      <div className="card panel">
        <div className="row"><h3 className="h-card">{offers.length} offers</h3><button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>+ New offer</button></div>
        {editing && <OfferForm offer={editing === "new" ? null : editing} merchants={merchants} cats={cats} insts={insts} done={() => { setEditing(null); load(); }} />}
        {offers.map((o) => (
          <div key={o.id} className="list-row">
            <div><b>{o.title}</b> <span className="tag soft" style={{ fontSize: 11 }}>{o.status}</span>
              <div className="meta">{o.merchant?.name ?? "No merchant"} · {o.category} · {o.channel === "IN_STORE" ? "In store" : "Online"}{o.discountType ? ` · ${o.discountType === "PERCENT" ? `${(o.discountValue ?? 0) / 100}% off` : `${formatLkr(o.discountValue ?? 0)} off`}` : ""}{o.sponsor ? ` · sponsored by ${o.sponsor.shortName}` : ""} · {o.redemptions} redeemed</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(o)}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OfferForm({ offer, merchants, cats, insts, done }: { offer: Offer | null; merchants: Merchant[]; cats: string[]; insts: Inst[]; done: () => void }) {
  const [type, setType] = useState<string>(offer?.discountType ?? "PERCENT");
  const [busy, setBusy] = useState(false);
  const o = offer;
  const shown = (c: number | null) => (c == null ? "" : String(c / 100));
  return (
    <form className="card panel" style={{ background: "var(--surface-2)" }} onSubmit={async (e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
      const dt = v("type") || null;
      const json = {
        title: v("title"), merchantId: v("merchant") || null, category: v("category"), badge: v("badge"), benefit: v("benefit"), howTo: v("howTo"),
        channel: v("channel"), districts: f.getAll("districts").map(String), status: v("status"), externalUrl: v("url"),
        discountType: dt, discountValue: dt === "PERCENT" ? (v("value") ? Math.round(Number(v("value")) * 100) : null) : cents(v("value")),
        maxDiscountCents: cents(v("max")), minSpendCents: cents(v("min")),
        sponsorId: dt === "SPONSORED" ? v("sponsor") || null : null, sponsorBudgetCents: dt === "SPONSORED" ? cents(v("budget")) : null,
        limitPerWeek: int(v("week")), limitPerYear: int(v("year")),
      };
      setBusy(true);
      try { await api(o ? `/admin/offers/${o.id}` : "/admin/offers", { method: o ? "PUT" : "POST", json }); toast(o ? "Offer saved" : "Offer created"); done(); }
      catch (er) { toast(errMsg(er)); } finally { setBusy(false); }
    }}>
      <h3 className="h-card">{o ? `Edit “${o.title}”` : "New offer"}</h3>
      <div className="form-grid">
        <div className="field full"><label htmlFor="o-t">Title</label><input className="input" id="o-t" name="title" required minLength={3} defaultValue={o?.title} placeholder="Student coffee: 10% off" /></div>
        <div className="field"><label htmlFor="o-m">Merchant</label><select className="select" id="o-m" name="merchant" defaultValue={o?.merchant?.id ?? ""}><option value="">None (browse-only)</option>{merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div className="field"><label htmlFor="o-s">Status</label><select className="select" id="o-s" name="status" defaultValue={o?.status ?? "LIVE"}>
          <option value="LIVE">Live: redeemable</option><option value="PROSPECT">Browse only (terms pending)</option><option value="DRAFT">Draft: hidden</option><option value="PAUSED">Paused</option><option value="ENDED">Ended</option></select></div>
        <div className="field"><label htmlFor="o-c">Category</label><select className="select" id="o-c" name="category" defaultValue={o?.category}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="o-b">Card word (≤ 8)</label><input className="input" id="o-b" name="badge" required maxLength={8} defaultValue={o?.badge} placeholder="Brew" /></div>
        <div className="field"><label htmlFor="o-ch">Where</label><select className="select" id="o-ch" name="channel" defaultValue={o?.channel ?? "IN_STORE"}><option value="IN_STORE">In store (scan at the till)</option><option value="ONLINE">Online</option></select></div>
        <div className="field"><label htmlFor="o-u">Online link (optional)</label><input className="input" id="o-u" name="url" type="url" defaultValue={o?.externalUrl ?? ""} /></div>
        <div className="field full"><label htmlFor="o-be">What students get</label><input className="input" id="o-be" name="benefit" required minLength={5} defaultValue={o?.benefit} /></div>
        <div className="field full"><label htmlFor="o-h">How to use it</label><input className="input" id="o-h" name="howTo" required minLength={5} defaultValue={o?.howTo} placeholder="Show your pass QR at the counter." /></div>
        <div className="field full"><label>Districts (none = everywhere)</label>
          <div className="chips">{DISTRICTS.map((d) => <label key={d} className="chip" style={{ cursor: "pointer" }}><input type="checkbox" name="districts" value={d} defaultChecked={o?.districts.includes(d)} style={{ marginRight: 6 }} />{d}</label>)}</div></div>
        <div className="field"><label htmlFor="o-dt">Discount</label><select className="select" id="o-dt" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off</option><option value="SPONSORED">Sponsored by an institution</option><option value="">None (browse-only)</option></select></div>
        {type && <div className="field"><label htmlFor="o-v">{type === "PERCENT" ? "Percent off" : type === "FIXED" ? "LKR off" : "Institution pays up to (LKR)"}</label>
          <input className="input" id="o-v" name="value" inputMode="decimal" required defaultValue={o?.discountType === "PERCENT" ? String((o.discountValue ?? 0) / 100) : shown(o?.discountValue ?? null)} /></div>}
        {type && <div className="field"><label htmlFor="o-max">Max discount (LKR, optional)</label><input className="input" id="o-max" name="max" inputMode="decimal" defaultValue={shown(o?.maxDiscountCents ?? null)} /></div>}
        {type && <div className="field"><label htmlFor="o-min">Min spend (LKR, optional)</label><input className="input" id="o-min" name="min" inputMode="decimal" defaultValue={shown(o?.minSpendCents ?? null)} /></div>}
        {type === "SPONSORED" && <>
          <div className="field"><label htmlFor="o-sp">Sponsoring institution</label><select className="select" id="o-sp" name="sponsor" required defaultValue={o?.sponsor?.id ?? ""}><option value="" disabled>Choose…</option>{insts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
          <div className="field"><label htmlFor="o-bud">Budget remaining (LKR)</label><input className="input" id="o-bud" name="budget" inputMode="decimal" required defaultValue={shown(o?.sponsorBudgetCents ?? null)} /></div>
        </>}
        {type && <div className="field"><label htmlFor="o-w">Uses per week (optional)</label><input className="input" id="o-w" name="week" type="number" min={1} defaultValue={o?.limitPerWeek ?? ""} /></div>}
        {type && <div className="field"><label htmlFor="o-y">Uses per year (optional)</label><input className="input" id="o-y" name="year" type="number" min={1} defaultValue={o?.limitPerYear ?? ""} /></div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" disabled={busy}>{o ? "Save offer" : "Create offer"}</button><button type="button" className="btn btn-ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}
