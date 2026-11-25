"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, formatLkr, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";

interface Product { id: string; title: string; category: string; subtitle: string; art: string; priceCents: number; rrpCents: number | null; stock: number | null; active: boolean; openReservations: number }
interface Res { id: string; code: string; quantity: number; priceCents: number; status: string; expiresAt: string; collectedAt: string | null; product: { title: string }; student: { name: string; institution: string } }

const lkrToCents = (v: string) => Math.round(Number(v.replace(/[^\d.]/g, "")) * 100);

/** Merchant side of the Student Shop: products at student prices, reservations, collection. */
export function ShopManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [res, setRes] = useState<Res[]>([]);
  const [denied, setDenied] = useState(false);
  const load = useCallback(() => {
    api<{ products: Product[]; categories: string[] }>("/pos/products").then((r) => { setProducts(r.products); setCats(r.categories); })
      .catch((e) => { if ((e as ApiFailure).status === 401 || (e as ApiFailure).status === 403) setDenied(true); });
    api<{ reservations: Res[] }>("/pos/reservations").then((r) => setRes(r.reservations)).catch(() => {});
  }, []);
  useEffect(load, [load]);
  if (denied || !products) return null;

  const err = (e: unknown) => { const f = e as ApiFailure; toast(f.issues ? Object.values(f.issues).flat()[0] ?? f.message : f.message); };
  const open = res.filter((r) => r.status === "RESERVED");

  return (
    <section style={{ paddingTop: 32 }}>
      <div className="sec-head"><div className="l"><span className="eyebrow">Student Shop</span><h2 className="h-sec">Reservations and products.</h2></div>
        <p className="r">Students reserve at your student price and pay you at the till. Enter their code when they collect.</p></div>
      <div className="panel-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const code = String(new FormData(form).get("code") ?? "").trim();
            try {
              const r = await api<{ product: string; quantity: number; totalCents: number; student: string }>("/pos/reservations/collect", { method: "POST", json: { code } });
              toast(`Collected: ${r.product} × ${r.quantity} for ${r.student}. Take ${formatLkr(r.totalCents)}.`); form.reset(); load();
            } catch (er) { err(er); }
          }}>
            <h3 className="h-card">Collect an order</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" name="code" required minLength={4} placeholder="Student’s code" aria-label="Collection code" style={{ flex: 1, textTransform: "uppercase", fontFamily: "var(--font-mono)" }} autoComplete="off" />
              <button className="btn btn-mint">Collected</button>
            </div>
            <span className="tiny">Take payment first, then mark it collected. The student earns Pass Points.</span>
          </form>
          <div className="card panel">
            <h3 className="h-card">{open.length} open {open.length === 1 ? "reservation" : "reservations"}</h3>
            {res.slice(0, 40).map((r) => (
              <div key={r.id} className="list-row">
                <div><b>{r.product.title}</b> × {r.quantity}<div className="meta">{r.student.name} · {r.student.institution} · {formatLkr(r.priceCents * r.quantity)} · {r.status === "RESERVED" ? `hold until ${fmtDate(r.expiresAt)}` : r.status.toLowerCase()}</div></div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="tiny" style={{ fontFamily: "var(--font-mono)" }}>{r.code}</span>
                  {r.status === "RESERVED" && <button className="btn btn-ghost btn-sm" onClick={async () => { if (!window.confirm("Cancel this reservation? The stock goes back on sale.")) return; try { await api(`/pos/reservations/${r.id}/cancel`, { method: "POST" }); load(); } catch (er) { err(er); } }}>Cancel</button>}
                </div>
              </div>
            ))}
            {!res.length && <p className="muted small" style={{ margin: 0 }}>No reservations yet.</p>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const v = (k: string) => String(f.get(k) ?? "").trim();
            try {
              await api("/pos/products", { method: "POST", json: {
                title: v("title"), category: v("category"), subtitle: v("subtitle"), art: v("art"),
                priceCents: lkrToCents(v("price")), rrpCents: v("rrp") ? lkrToCents(v("rrp")) : null, stock: v("stock") ? Number(v("stock")) : null,
              } });
              toast("Product listed"); form.reset(); load();
            } catch (er) { err(er); }
          }}>
            <h3 className="h-card">List a product</h3>
            <div className="form-grid">
              <div className="field full"><label htmlFor="pr-t">Product</label><input className="input" id="pr-t" name="title" required minLength={2} /></div>
              <div className="field"><label htmlFor="pr-c">Category</label><select className="select" id="pr-c" name="category">{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label htmlFor="pr-a">Card label (≤ 8)</label><input className="input" id="pr-a" name="art" maxLength={8} placeholder="14″" /></div>
              <div className="field"><label htmlFor="pr-p">Student price (LKR)</label><input className="input" id="pr-p" name="price" inputMode="decimal" required /></div>
              <div className="field"><label htmlFor="pr-r">Usual price (LKR)</label><input className="input" id="pr-r" name="rrp" inputMode="decimal" /></div>
              <div className="field"><label htmlFor="pr-s">Stock (blank = no limit)</label><input className="input" id="pr-s" name="stock" type="number" min={0} /></div>
              <div className="field full"><label htmlFor="pr-sub">Short description</label><input className="input" id="pr-sub" name="subtitle" maxLength={160} /></div>
            </div>
            <button className="btn btn-primary">List product</button>
          </form>
          <div className="card panel">
            <h3 className="h-card">{products.length} products</h3>
            {products.map((p) => (
              <div key={p.id} className="list-row">
                <div><b>{p.title}</b>{!p.active && <span className="tiny"> · hidden</span>}<div className="meta">{p.category} · {formatLkr(p.priceCents)}{p.rrpCents ? ` (usual ${formatLkr(p.rrpCents)})` : ""} · {p.stock === null ? "no stock limit" : `${p.stock} in stock`} · {p.openReservations} reserved</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { const n = window.prompt("Stock now (blank = no limit)", p.stock === null ? "" : String(p.stock)); if (n === null) return; try { await api(`/pos/products/${p.id}`, { method: "PATCH", json: { stock: n.trim() === "" ? null : Number(n) } }); load(); } catch (er) { err(er); } }}>Stock</button>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { try { await api(`/pos/products/${p.id}`, { method: "PATCH", json: { active: !p.active } }); load(); } catch (er) { err(er); } }}>{p.active ? "Hide" : "Show"}</button>
                </div>
              </div>
            ))}
            {!products.length && <p className="muted small" style={{ margin: 0 }}>List your first product to appear in the Student Shop.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
