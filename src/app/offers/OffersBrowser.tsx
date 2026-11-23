"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ApiFailure, toast } from "@/lib/client";

// Keep in sync with src/lib/offers.ts (server).
const CATEGORIES: [string, string][] = [
  ["Food & drink", "var(--coral)"], ["Cinema & events", "var(--pink)"], ["Fitness", "var(--mint)"],
  ["AI & productivity", "var(--cyan)"], ["Design & media", "var(--lilac)"], ["Study & work", "var(--cyan)"],
  ["Music & streaming", "var(--pink)"], ["Essentials", "var(--sun)"],
];
const DISTRICTS = ["Colombo", "Gampaha", "Kandy", "Galle", "Jaffna", "Kurunegala"];
const CHANNELS = [["", "All"], ["IN_STORE", "In store"], ["ONLINE", "Online"], ["SAVED", "Saved"]] as const;
const catColor = (c: string) => CATEGORIES.find(([id]) => id === c)?.[1] ?? "#B4B4C0";

interface Offer {
  id: string; slug: string; title: string; benefit: string; howTo: string; category: string; badge: string;
  channel: "IN_STORE" | "ONLINE"; districts: string[]; status: "LIVE" | "PROSPECT"; saved: boolean;
  merchant: { name: string } | null; sponsor: { shortName: string } | null;
}

export function OffersBrowser() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number][0]>("");
  const [district, setDistrict] = useState("");
  const [open, setOpen] = useState<Offer | null>(null);

  // Debounced server-side filtering.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (channel === "SAVED") params.set("saved", "1");
    else if (channel) params.set("channel", channel);
    if (district) params.set("district", district);
    const t = setTimeout(() => {
      api<{ offers: Offer[] }>(`/offers?${params}`).then((r) => setOffers(r.offers)).catch(() => setOffers([]));
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [q, category, channel, district]);

  async function toggleSave(o: Offer) {
    try {
      await api(`/offers/${o.id}/save`, { method: o.saved ? "DELETE" : "PUT" });
      setOffers((xs) => (channel === "SAVED" && o.saved ? xs!.filter((x) => x.id !== o.id) : xs!.map((x) => (x.id === o.id ? { ...x, saved: !o.saved } : x))));
      setOpen((x) => (x?.id === o.id ? { ...x, saved: !o.saved } : x));
      toast(o.saved ? "Removed from saved" : "Saved");
    } catch (e) {
      toast(e instanceof ApiFailure && e.status === 401 ? "Sign in to save offers" : "Couldn’t save that offer");
    }
  }

  const count = useMemo(() => offers?.length ?? 0, [offers]);

  return (
    <>
      <div className="toolbar">
        <div className="search" style={{ flex: "1 1 320px" }}>
          <Icon name="i-search" />
          <label className="sr" htmlFor="offerQ">Search offers</label>
          <input className="input" id="offerQ" type="search" placeholder="Search coffee, cinema, gyms…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="seg" role="tablist" aria-label="Channel">
          {CHANNELS.map(([v, label]) => (
            <button key={label} role="tab" aria-selected={channel === v} onClick={() => setChannel(v)}
              style={channel === v ? { background: "var(--text)", color: "var(--invert)" } : undefined}>{label}</button>
          ))}
        </div>
        <label className="sr" htmlFor="district">District</label>
        <select className="select" id="district" style={{ minWidth: 170 }} value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">All districts</option>
          {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      <div className="chips" role="group" aria-label="Category">
        <button className="chip" aria-pressed={!category} onClick={() => setCategory("")}>All</button>
        {CATEGORIES.map(([c, color]) => (
          <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)}>
            <span className="dot" style={{ background: color }} />{c}
          </button>
        ))}
      </div>

      <p className="tiny" aria-live="polite" style={{ marginTop: -12 }}>{offers ? `${count} offer${count === 1 ? "" : "s"}` : "Loading…"}</p>

      <div className="offers">
        {offers?.map((o, i) => (
          <article key={o.id} className="card offer hover" style={{ animationDelay: `${i * 40}ms` }} tabIndex={0} role="button"
            aria-label={`${o.title}, ${o.benefit}`} onClick={() => setOpen(o)} onKeyDown={(e) => e.key === "Enter" && setOpen(o)}>
            <div className="art" style={{ background: catColor(o.category) }}><div className="shape" /><span className="big">{o.badge}</span></div>
            <div className="body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span className="tag soft">{o.category}</span>
                <span className="tiny">{o.channel === "IN_STORE" ? "In store" : "Online"}</span>
              </div>
              <span className="ttl">{o.title}</span>
              <span className="muted small">{o.benefit}</span>
              <div className="foot">
                <span className="tag" style={{ background: o.status === "LIVE" ? "var(--mint)" : "var(--surface-2)", color: o.status === "LIVE" ? "#0B0B10" : "var(--text-2)" }}>
                  {o.status === "LIVE" ? (o.sponsor ? `Sponsored · ${o.sponsor.shortName}` : "Live") : "Terms pending"}
                </span>
                <button className="heart" aria-pressed={o.saved} aria-label={o.saved ? "Remove from saved" : "Save offer"}
                  onClick={(e) => { e.stopPropagation(); toggleSave(o); }}>
                  <Icon name={o.saved ? "i-heart-f" : "i-heart"} size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
        {offers && !offers.length && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <h3 className="h-card">Nothing here yet</h3>
            <p>{channel === "SAVED" ? "Tap the heart on any offer to save it. You’ll need to be signed in." : "Try another search, district or category."}</p>
          </div>
        )}
      </div>

      <OfferSheet offer={open} onClose={() => setOpen(null)} onSave={toggleSave} />
    </>
  );
}

function OfferSheet({ offer, onClose, onSave }: { offer: Offer | null; onClose: () => void; onSave: (o: Offer) => void }) {
  useEffect(() => {
    if (!offer) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [offer, onClose]);
  const on = !!offer;
  return (
    <>
      <div className={`scrim${on ? " on" : ""}`} onClick={onClose} />
      <div className={`sheet${on ? " on" : ""}`} role="dialog" aria-modal="true" aria-hidden={!on} aria-labelledby="sheetTitle">
        <div className="grabber" />
        {offer && (
          <div>
            <div style={{ height: 130, borderRadius: 28, background: catColor(offer.category), marginBottom: 22, display: "flex", alignItems: "flex-end", padding: 20, position: "relative", overflow: "hidden" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 58, fontWeight: 600, color: "#0B0B10", letterSpacing: "-.05em", lineHeight: 0.8 }}>{offer.badge}</span>
            </div>
            <span className="tag soft">{offer.category}</span>
            <h2 id="sheetTitle" className="h-card" style={{ fontSize: 30, margin: "12px 0 6px" }}>{offer.title}</h2>
            <p className="muted" style={{ margin: 0 }}>{offer.benefit}</p>
            <dl className="kv">
              <dt>Where</dt><dd>{offer.channel === "ONLINE" ? "Online" : offer.districts.join(", ") || "All districts"}</dd>
              {offer.merchant && (<><dt>Partner</dt><dd>{offer.merchant.name}</dd></>)}
              {offer.sponsor && (<><dt>Sponsored by</dt><dd>{offer.sponsor.shortName} · for its students only</dd></>)}
              <dt>How it works</dt><dd>{offer.howTo}</dd>
              <dt>Status</dt><dd>{offer.status === "LIVE" ? "Live: show your pass to redeem" : "Terms pending. Not redeemable yet"}</dd>
            </dl>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {offer.status === "LIVE" && offer.channel === "IN_STORE" && <Link className="btn btn-mint" href="/pass" onClick={onClose}><Icon name="i-qr" size={18} />Show my pass</Link>}
              <button className="btn btn-ghost" onClick={() => onSave(offer)}>
                <Icon name={offer.saved ? "i-heart-f" : "i-heart"} size={18} />{offer.saved ? "Saved" : "Save"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
