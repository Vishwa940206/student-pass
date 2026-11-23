"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { api, ApiFailure, formatLkr, toast } from "@/lib/client";

interface Location { id: string; code: string; name: string; district: string; inProgramme: boolean }
interface ScanResult {
  student: { name: string; institution: string; verified: boolean; frozen: boolean };
  offers: ({ offerId: string; title: string } & ({ ok: true; discountCents: number } | { ok: false; code: string; message: string }))[];
}
interface Hold { id: string; discountCents: number; subtotalCents: number; offerTitle: string }
interface LedgerRow {
  id: string; ref: string; discountCents: number; voidedAt: string | null; createdAt: string;
  offer: { title: string; sponsor: { shortName: string } | null };
  authorization: { subtotalCents: number; location: { code: string } };
}
type Tone = "" | "ok" | "warn" | "err";

const newKey = () => crypto.randomUUID();
const noop = () => () => {};

export function PosTill() {
  const [access, setAccess] = useState<"loading" | "denied" | "ok">("loading");
  const [merchant, setMerchant] = useState<{ name: string; locations: Location[] } | null>(null);
  const [locationId, setLocationId] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [offerId, setOfferId] = useState("");
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: Tone }>({ text: "Ready. Enter the bill, then scan the student’s pass.", tone: "" });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  // Idempotency key for the current "Apply": created on first click, reused on retry.
  const authKey = useRef<string | null>(null);

  const subtotalCents = Math.round((parseFloat(amount) || 0) * 100);
  const loc = merchant?.locations.find((l) => l.id === locationId);

  const loadLedger = useCallback(() => api<{ redemptions: LedgerRow[] }>("/pos/redemptions").then((r) => setLedger(r.redemptions)), []);

  useEffect(() => {
    api<{ name: string; locations: Location[] }>("/pos/locations")
      .then((m) => {
        setMerchant(m);
        setLocationId(m.locations.find((l) => l.inProgramme)?.id ?? m.locations[0]?.id ?? "");
        setAccess("ok");
        loadLedger();
      })
      .catch((e) => setAccess(e instanceof ApiFailure && (e.status === 401 || e.status === 403) ? "denied" : "ok"));
  }, [loadLedger]);

  const fail = (e: unknown) => setMsg({ text: (e as Error).message, tone: "err" });

  function resetSale(text = "Ready for the next customer.", tone: Tone = "") {
    setToken(""); setScan(null); setOfferId(""); setHold(null); setAmount("");
    authKey.current = null;
    setMsg({ text, tone });
  }

  async function doScan(t = token) {
    if (!t.trim()) return setMsg({ text: "Scan or paste the student’s QR code.", tone: "warn" });
    if (subtotalCents <= 0) return setMsg({ text: "Enter the bill amount first.", tone: "warn" });
    setBusy(true);
    try {
      const r = await api<ScanResult>("/pos/scan", { method: "POST", json: { token: t.trim(), locationId, subtotalCents } });
      setScan(r);
      const best = r.offers.filter((o) => o.ok).sort((a, b) => (b.ok ? b.discountCents : 0) - (a.ok ? a.discountCents : 0))[0];
      setOfferId(best?.offerId ?? "");
      authKey.current = null;
      setMsg(best
        ? { text: `${r.student.name} · ${r.student.institution}. Best offer selected.`, tone: "ok" }
        : { text: `${r.student.name} · ${r.student.institution}. No offer applies to this basket.`, tone: "warn" });
    } catch (e) {
      setScan(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const o = scan?.offers.find((x) => x.offerId === offerId);
    if (!o) return;
    setBusy(true);
    try {
      const { authorization: a } = await api<{ authorization: { id: string; discountCents: number; subtotalCents: number } }>("/pos/authorizations", {
        method: "POST",
        headers: { "Idempotency-Key": (authKey.current ??= newKey()) },
        json: { token: token.trim(), offerId, locationId, subtotalCents },
      });
      setHold({ id: a.id, discountCents: a.discountCents, subtotalCents: a.subtotalCents, offerTitle: o.title });
      setMsg({ text: `${o.title} applied. Take payment, then complete the sale.`, tone: "ok" });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!hold) return;
    setBusy(true);
    try {
      const { redemption } = await api<{ redemption: { ref: string; discountCents: number } }>(`/pos/authorizations/${hold.id}/capture`, { method: "POST" });
      toast(`Sale complete · ${redemption.ref}`);
      resetSale(`Sale complete · ${redemption.ref} · saved ${formatLkr(redemption.discountCents)}`, "ok");
      loadLedger();
    } catch (e) {
      fail(e);
      if (e instanceof ApiFailure && e.code === "HOLD_EXPIRED") setHold(null);
    } finally {
      setBusy(false);
    }
  }

  async function cancelHold(reason = "Hold released. Basket changed or sale abandoned.") {
    if (!hold) return resetSale();
    setBusy(true);
    try {
      await api(`/pos/authorizations/${hold.id}/cancel`, { method: "POST" });
      resetSale(reason, "warn");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function voidRow(r: LedgerRow) {
    const reason = window.prompt(`Refund ${r.ref}? Enter a reason:`, "Customer refund");
    if (!reason) return;
    try {
      await api(`/pos/redemptions/${r.id}/void`, { method: "POST", json: { reason } });
      toast(`${r.ref} voided`);
      loadLedger();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  if (access === "loading") return <p className="muted">Loading till…</p>;
  if (access === "denied") {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 560 }}>
        <h3 className="h-card">Merchant staff only</h3>
        <p className="muted">Sign in with a merchant staff account to use the POS.</p>
        <Link className="btn btn-primary" href="/login">Sign in</Link>
      </div>
    );
  }

  const total = subtotalCents - (hold?.discountCents ?? 0);
  const locked = !!hold || busy;

  return (
    <div className="pos-grid">
      {/* ── Left: branch + scan ── */}
      <div className="card">
        <span className="eyebrow">{merchant?.name} · Branch</span>
        {merchant?.locations.map((l) => (
          <button key={l.id} className="opt" aria-pressed={locationId === l.id} disabled={locked} onClick={() => { setLocationId(l.id); setScan(null); }}>
            <b>{l.name} · {l.code}</b><span className="tiny">{l.district}{l.inProgramme ? "" : " · not in programme"}</span>
          </button>
        ))}
        <span className="eyebrow" style={{ marginTop: 8 }}>Student QR</span>
        <Scanner disabled={locked} onCode={(c) => { setToken(c); doScan(c); }} />
        <div className="field">
          <label htmlFor="tok">…or paste the code</label>
          <input className="input" id="tok" value={token} disabled={locked} onChange={(e) => { setToken(e.target.value); setScan(null); }}
            placeholder="SP1.…" autoComplete="off" spellCheck={false} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
        </div>
      </div>

      {/* ── Middle: sale ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="h-card">Till · {loc?.name ?? "—"}</h3>
          {hold && <span className="tag" style={{ background: "var(--sun)" }}>Discount held</span>}
        </div>
        <div className="field">
          <label htmlFor="amt">Bill amount (LKR)</label>
          <input className="input" id="amt" inputMode="decimal" value={amount} disabled={locked}
            onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setScan(null); }} placeholder="e.g. 1600" style={{ fontSize: 22, fontWeight: 600 }} />
        </div>

        {scan && (
          <div className="offer-pick">
            <div className="stat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><span className="tiny">Student</span><b>{scan.student.name}</b></div>
              <span className="tag" style={{ background: scan.student.verified && !scan.student.frozen ? "var(--mint)" : "var(--coral)" }}>
                {scan.student.institution} · {scan.student.frozen ? "frozen" : scan.student.verified ? "verified" : "not verified"}
              </span>
            </div>
            {scan.offers.map((o) => (
              <button key={o.offerId} className="opt" aria-pressed={offerId === o.offerId} disabled={!o.ok || locked} onClick={() => setOfferId(o.offerId)}
                style={!o.ok ? { opacity: 0.6 } : undefined}>
                <b>{o.title}{o.ok ? ` · −${formatLkr(o.discountCents)}` : ""}</b>
                <span className="tiny">{o.ok ? "Eligible" : o.message}</span>
              </button>
            ))}
            {!scan.offers.length && <span className="tiny">This merchant has no live offers.</span>}
          </div>
        )}

        <div className="basket" style={{ minHeight: 0 }}>
          <div className="bl"><span>Bill</span><span>{formatLkr(subtotalCents)}</span></div>
          {hold && <div className="bl disc"><span>↳ {hold.offerTitle}</span><span>−{formatLkr(hold.discountCents)}</span></div>}
          <div className="total"><span>Total</span><span>{formatLkr(total)}</span></div>
        </div>

        <div className={`msg ${msg.tone}`} role="status">{msg.text}</div>

        {!hold ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => doScan()}><Icon name="i-qr" size={18} />Check pass</button>
            <button className="btn btn-mint" disabled={busy || !scan || !offerId} onClick={apply}>Apply offer</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="btn btn-ghost" disabled={busy} onClick={() => cancelHold()}>Cancel</button>
            <button className="btn btn-mint" disabled={busy} onClick={complete}>Complete sale</button>
          </div>
        )}
        {!hold && (scan || token || amount) && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => resetSale()}>Clear</button>}
      </div>

      {/* ── Right: ledger ── */}
      <div className="card">
        <div className="stats3">
          <div className="stat"><span className="tiny">Today</span><b>{ledger.filter((r) => !r.voidedAt && new Date(r.createdAt).toDateString() === new Date().toDateString()).length}</b></div>
          <div className="stat"><span className="tiny">Discounts</span><b style={{ fontSize: 16 }}>{formatLkr(ledger.filter((r) => !r.voidedAt).reduce((s, r) => s + r.discountCents, 0))}</b></div>
          <div className="stat"><span className="tiny">Sponsored</span><b>{ledger.filter((r) => !r.voidedAt && r.offer.sponsor).length}</b></div>
        </div>
        <span className="eyebrow">Redemption ledger</span>
        <div>
          {ledger.map((r) => (
            <div key={r.id} className={`ledger-row${r.voidedAt ? " void" : ""}`}>
              <span>{r.ref} · {r.authorization.location.code}<br /><span style={{ fontFamily: "var(--font-ui)" }} className="tiny">{r.offer.title}</span></span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                −{formatLkr(r.discountCents)}
                {!r.voidedAt && <button className="btn btn-ghost btn-sm" style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }} onClick={() => voidRow(r)}>Refund</button>}
              </span>
            </div>
          ))}
          {!ledger.length && <span className="tiny">No redemptions yet.</span>}
        </div>
      </div>
    </div>
  );
}

// ── Camera scanner (uses the browser's BarcodeDetector where available) ──
interface Detector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

function Scanner({ onCode, disabled }: { onCode: (code: string) => void; disabled: boolean }) {
  const [on, setOn] = useState(false);
  const supported = useSyncExternalStore(noop, () => !!window.BarcodeDetector, () => false);
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => { onCodeRef.current = onCode; });

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (s) => {
      stream = s;
      if (!video.current || stopped) return;
      video.current.srcObject = s;
      await video.current.play();
      const tick = async () => {
        if (stopped || !video.current) return;
        const codes = await detector.detect(video.current).catch(() => []);
        const hit = codes.find((c) => c.rawValue.startsWith("SP1."));
        if (hit) { setOn(false); onCodeRef.current(hit.rawValue); return; }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => { setOn(false); toast("Camera unavailable. Paste the code instead"); });
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);

  if (!supported) return <span className="tiny">Camera scanning isn’t supported in this browser (try Chrome or Edge on Android). Paste the code below instead.</span>;
  return (
    <>
      {on && <video ref={video} className="scanner" muted playsInline />}
      <button className="btn btn-primary btn-sm" disabled={disabled} onClick={() => setOn(!on)}>
        <Icon name="i-qr" size={16} />{on ? "Stop camera" : "Scan with camera"}
      </button>
    </>
  );
}
