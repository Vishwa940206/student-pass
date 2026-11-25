"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ApiFailure, fetchMe, formatLkr, toast, type Me } from "@/lib/client";
import { fmtDate } from "@/lib/format";

export const SHOP_COLORS: Record<string, string> = {
  Books: "var(--lilac)", "eBooks & audio": "var(--cyan)", "Software & subscriptions": "var(--mint)", "Laptops & tech": "var(--coral)",
  Accessories: "var(--sun)", "Stationery & study": "var(--sun)", "Room & living": "var(--lilac)", "Food & drinks": "var(--coral)",
  "Health & care": "var(--lilac)", "Fashion & merch": "var(--cyan)", Travel: "var(--sun)", "Gift cards": "var(--mint)",
};
export interface Product {
  id: string; title: string; category: string; subtitle: string; description: string; art: string;
  priceCents: number; rrpCents: number | null; stock: number | null;
  merchant: { id: string; name: string; locations: { name: string; district: string }[] };
}
interface Reservation {
  id: string; code: string; quantity: number; priceCents: number; status: string; expiresAt: string; collectedAt: string | null;
  product: { title: string; art: string; category: string; merchant: { name: string; locations: { name: string }[] } };
}

/** Product card in the design's style. */
export function ProductCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  return (
    <article className="card prod hover" tabIndex={0} role="button" aria-label={`${p.title}, ${formatLkr(p.priceCents)}`}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <div className="art" style={{ background: SHOP_COLORS[p.category] ?? "var(--sun)" }}>
        <div className="shape" />
        {p.stock !== null && p.stock <= 3 && <span className="tag badge" style={{ background: "#0B0B10", color: "#F5F5F7" }}>{p.stock ? `Only ${p.stock} left` : "Sold out"}</span>}
        <span className="big">{p.art || p.title.slice(0, 3)}</span>
      </div>
      <div className="bd">
        <span className="tiny">{p.category} · {p.merchant.name}</span>
        <b style={{ fontSize: 15, lineHeight: 1.3 }}>{p.title}</b>
        {p.subtitle && <span className="tiny">{p.subtitle}</span>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8 }}>
          <div className="price"><b>{formatLkr(p.priceCents)}</b>{p.rrpCents && <s>{formatLkr(p.rrpCents)}</s>}</div>
          <span className="add" aria-hidden="true">+</span>
        </div>
      </div>
    </article>
  );
}

export function ShopView() {
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") ?? "");
  const [cat, setCat] = useState("All");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [mine, setMine] = useState<Reservation[]>([]);
  const [open, setOpen] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; expiresAt: string } | null>(null);

  const loadMine = useCallback(() => { api<{ reservations: Reservation[] }>("/shop/reservations").then((r) => setMine(r.reservations)).catch(() => setMine([])); }, []);
  const loadProducts = useCallback(() => { api<{ products: Product[] }>("/shop/products").then((r) => setProducts(r.products)).catch(() => setProducts([])); }, []);
  useEffect(() => {
    loadProducts();
    fetchMe().then((m) => { setMe(m); if (m?.student?.verificationStatus === "VERIFIED") loadMine(); }).catch(() => setMe(null));
  }, [loadMine, loadProducts]);

  const cats = useMemo(() => ["All", ...new Set((products ?? []).map((p) => p.category))], [products]);
  const shown = (products ?? []).filter((p) => (cat === "All" || p.category === cat) && (!q || `${p.title} ${p.subtitle} ${p.category} ${p.merchant.name}`.toLowerCase().includes(q.toLowerCase())));
  const verified = me?.student?.verificationStatus === "VERIFIED";
  const openRes = mine.filter((r) => r.status === "RESERVED");

  async function reserve() {
    if (!open) return;
    setBusy(true);
    try {
      const r = await api<{ code: string; expiresAt: string }>(`/shop/products/${open.id}/reserve`, { method: "POST", json: { quantity: qty } });
      setDone(r); loadMine(); loadProducts();
    } catch (e) { toast((e as ApiFailure).message); } finally { setBusy(false); }
  }

  return (
    <>
      {openRes.length > 0 && (
        <div className="card panel" style={{ marginBottom: 18 }}>
          <h3 className="h-card">Ready to collect</h3>
          {openRes.map((r) => (
            <div key={r.id} className="list-row">
              <div><b>{r.product.title}</b> × {r.quantity}<div className="meta">{r.product.merchant.name}{r.product.merchant.locations.length ? ` · ${r.product.merchant.locations.map((l) => l.name).join(", ")}` : ""} · pay {formatLkr(r.priceCents * r.quantity)} at the till · hold until {fmtDate(r.expiresAt)}</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="secret" style={{ fontSize: 16, padding: "8px 12px" }}>{r.code}</span>
                <button className="btn btn-ghost btn-sm" onClick={async () => { if (!window.confirm("Cancel this reservation?")) return; try { await api(`/shop/reservations/${r.id}/cancel`, { method: "POST" }); toast("Reservation cancelled"); loadMine(); loadProducts(); } catch (e) { toast((e as Error).message); } }}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="search" style={{ flex: "1 1 320px" }}>
          <Icon name="i-search" />
          <label className="sr" htmlFor="shopQ">Search the shop</label>
          <input className="input" id="shopQ" type="search" placeholder="Search books, laptops, subscriptions…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="chips" role="group" aria-label="Category" style={{ marginBottom: 18 }}>
        {cats.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c !== "All" && <span className="dot" style={{ background: SHOP_COLORS[c] ?? "var(--sun)" }} />}{c}
          </button>
        ))}
      </div>

      {!products ? <p className="muted">Loading products…</p> : shown.length ? (
        <div className="prods">{shown.map((p) => <ProductCard key={p.id} p={p} onOpen={() => { setOpen(p); setQty(1); setDone(null); }} />)}</div>
      ) : (
        <div className="empty">{products.length ? "No products match." : "Partner shops are adding their student prices. Check back soon."}</div>
      )}

      <div className={`scrim${open ? " on" : ""}`} onClick={() => setOpen(null)} aria-hidden="true" />
      <div className={`sheet${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label={open?.title ?? "Product"} aria-hidden={!open}>
        <div className="grabber" />
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 130, borderRadius: 28, background: SHOP_COLORS[open.category] ?? "var(--sun)", display: "flex", alignItems: "flex-end", padding: 20 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 58, fontWeight: 600, color: "#0B0B10", letterSpacing: "-.05em", lineHeight: 0.8 }}>{open.art || open.title.slice(0, 3)}</span>
            </div>
            <div className="row"><span className="tag soft">{open.category}</span><button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close"><Icon name="i-x" size={18} /></button></div>
            <h2 className="h-card" style={{ margin: 0 }}>{open.title}</h2>
            {open.subtitle && <p className="muted" style={{ margin: 0 }}>{open.subtitle}</p>}
            {open.description && <p style={{ margin: 0, whiteSpace: "pre-line" }}>{open.description}</p>}
            <div className="price" style={{ fontSize: 20 }}><b>{formatLkr(open.priceCents)}</b>{open.rrpCents && <s>{formatLkr(open.rrpCents)}</s>}</div>
            <div className="small">Sold by <b>{open.merchant.name}</b>{open.merchant.locations.length > 0 && <> · collect at {open.merchant.locations.map((l) => `${l.name} (${l.district})`).join(", ")}</>}</div>
            {done ? (
              <div className="card panel" style={{ background: "color-mix(in oklab, var(--mint) 18%, var(--surface))" }}>
                <b>Reserved. Show this code at the till:</b>
                <div className="secret" style={{ textAlign: "center", fontSize: 26 }}>{done.code}</div>
                <span className="small">Pay {formatLkr(open.priceCents * qty)} and collect by {fmtDate(done.expiresAt)}. You’ll earn Pass Points when you collect.</span>
              </div>
            ) : verified ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="small" htmlFor="qty">Quantity</label>
                <select id="qty" className="select" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ maxWidth: 90 }}>
                  {[1, 2, 3, 4, 5].filter((n) => open.stock === null || n <= open.stock).map((n) => <option key={n}>{n}</option>)}
                </select>
                <button className="btn btn-mint" disabled={busy || open.stock === 0} onClick={reserve}>{open.stock === 0 ? "Sold out" : busy ? "Reserving…" : `Reserve · ${formatLkr(open.priceCents * qty)}`}</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="small muted" style={{ flexBasis: "100%" }}>Student prices are for verified students.</span>
                {me ? <Link className="btn btn-primary btn-sm" href="/pass">Check my verification</Link> : <><Link className="btn btn-primary btn-sm" href="/signup">Get Student Pass</Link><Link className="btn btn-ghost btn-sm" href="/login">Sign in</Link></>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
