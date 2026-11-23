"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/Icon";
import { PassCard } from "@/components/PassCard";
import { api, ApiFailure, formatLkr, toast } from "@/lib/client";
import { SKINS } from "@/lib/skins";

interface PassInfo {
  name: string;
  institution: { name: string; shortName: string };
  studentNumber: string;
  programme: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  validUntil: string | null;
  passState: "ACTIVE" | "FROZEN";
  cardSkin: string;
  perks: { id: string; title: string; limitPerWeek: number | null; limitPerYear: number | null; usedThisWeek: number; usedThisYear: number; merchant: { name: string } | null }[];
  savedTotalCents: number;
  history: { id: string; ref: string; title: string; where: string; discountCents: number; createdAt: string }[];
}

const RING = 2 * Math.PI * 120;
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

export function PassView() {
  const [info, setInfo] = useState<PassInfo | null>(null);
  const [state, setState] = useState<"loading" | "signed-out" | "not-student" | "ready">("loading");

  const load = useCallback(
    () =>
      api<PassInfo>("/pass")
        .then((r) => {
          setInfo(r);
          setState("ready");
        })
        .catch((e) => {
          if (e instanceof ApiFailure && e.status === 401) setState("signed-out");
          else if (e instanceof ApiFailure && (e.status === 403 || e.status === 404)) setState("not-student");
          else toast("Couldn’t load your pass. Please try again");
        }),
    [],
  );

  useEffect(() => {
    load();
    window.addEventListener("sp:auth", load);
    return () => window.removeEventListener("sp:auth", load);
  }, [load]);

  if (state === "loading") return <p className="muted">Loading your pass…</p>;
  if (state === "signed-out") {
    return (
      <>
        <Header eyebrow="My Pass" title="Your pass lives here." note="Sign in to show your QR at the counter." />
        <div style={{ display: "flex", gap: 12 }}>
          <Link className="btn btn-mint" href="/signup">Get Student Pass</Link>
          <Link className="btn btn-ghost" href="/login">Sign in</Link>
        </div>
      </>
    );
  }
  if (state === "not-student" || !info) {
    return <Header eyebrow="My Pass" title="Student accounts only." note="This account is for merchant or admin use, so it doesn’t have a student pass." />;
  }

  const verified = info.verificationStatus === "VERIFIED";
  const frozen = info.passState === "FROZEN";

  return (
    <>
      {verified ? (
        <Header eyebrow={<><span className="status-dot" />&nbsp;Verified member</>} title="My Pass."
          note="Show the QR at the counter. It refreshes every 30 seconds, so screenshots won’t work." />
      ) : (
        <Header eyebrow="My Pass" title={info.verificationStatus === "REJECTED" ? "We couldn’t verify you." : "Almost there."}
          note={info.verificationStatus === "REJECTED"
            ? "Your student details didn’t match your institution’s records. Contact support to try again."
            : "Your account is set up. Your QR appears here once your student status is verified."} />
      )}

      <div className="pass-layout">
        <div className="pass-main">
          <div className="card wallet">
            {verified && !frozen ? (
              <LiveQr info={info} />
            ) : (
              <>
                <div className={`status-banner ${frozen ? "frozen" : "pending"}`} style={{ width: "100%", maxWidth: 500 }}>
                  {!verified
                    ? info.verificationStatus === "PENDING" ? "⏳ Verification pending. We’ll activate your pass once it’s approved." : "Verification unsuccessful."
                    : "❄️ Your pass is frozen. Merchants can’t scan it until you unfreeze it."}
                </div>
                <PassCard skin={info.cardSkin} name={shortName(info.name)} meta={info.institution.name} maxWidth={500} />
              </>
            )}
          </div>
        </div>

        <div className="pass-side">
          {info.perks.map((p) => {
            const used = p.limitPerWeek != null && p.usedThisWeek >= p.limitPerWeek;
            return (
              <div key={p.id} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, background: "linear-gradient(160deg,color-mix(in oklab,var(--lilac) 30%,transparent),var(--surface))" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="tag" style={{ background: "var(--lilac)" }}>{info.institution.shortName} · sponsored</span>
                  <span className="tiny">Resets Mon 00:00</span>
                </div>
                <h3 className="h-card">{p.title}</h3>
                <div className="allow"><span className={used ? "" : "full"} /><b>{used ? "Used this week" : `${(p.limitPerWeek ?? 1) - p.usedThisWeek} of ${p.limitPerWeek ?? 1} available`}</b></div>
                {p.limitPerYear != null && <span className="tiny">{p.usedThisYear} of {p.limitPerYear} used this year{p.merchant ? ` · at ${p.merchant.name}` : ""}</span>}
              </div>
            );
          })}
          {verified && !info.perks.length && (
            <div className="card" style={{ padding: 24 }}>
              <span className="tag soft">{info.institution.shortName}</span>
              <p className="muted small" style={{ margin: "10px 0 0" }}>Your institution hasn’t set up sponsored perks yet. Standard offers apply.</p>
            </div>
          )}

          <SkinPicker value={info.cardSkin} onChange={(cardSkin) => setInfo({ ...info, cardSkin })} />

          {verified && <FreezeSwitch frozen={frozen} onChange={(f) => setInfo({ ...info, passState: f ? "FROZEN" : "ACTIVE" })} />}

          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 className="h-card" style={{ whiteSpace: "nowrap" }}>Saved so far</h3>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 24, whiteSpace: "nowrap" }}>{formatLkr(info.savedTotalCents)}</b>
            </div>
            <span className="tiny">From completed redemptions</span>
            <div className="hist">
              {info.history.map((h) => (
                <div className="h" key={h.id}>
                  <div><div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div><div className="tiny">{h.where} · {new Date(h.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short" })}</div></div>
                  <b style={{ fontSize: 14 }}>−{formatLkr(h.discountCents)}</b>
                </div>
              ))}
              {!info.history.length && <span className="tiny" style={{ paddingTop: 10 }}>No redemptions yet. <Link href="/offers">Find an offer</Link>.</span>}
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <dl className="kv" style={{ margin: 0, border: 0, padding: 0 }}>
              <dt>Institution</dt><dd>{info.institution.name}</dd>
              <dt>Student no.</dt><dd>{info.studentNumber}</dd>
              {info.programme && (<><dt>Programme</dt><dd>{info.programme}</dd></>)}
              {info.validUntil && (<><dt>Valid until</dt><dd>{new Date(info.validUntil).toLocaleDateString("en-LK", { day: "numeric", month: "long", year: "numeric" })}</dd></>)}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}

function Header({ eyebrow, title, note }: { eyebrow: React.ReactNode; title: string; note: string }) {
  return (
    <div className="sec-head">
      <div className="l"><span className="eyebrow">{eyebrow}</span><h1 className="h-sec page-title">{title}</h1></div>
      <p className="r">{note}</p>
    </div>
  );
}

/** Fetches a fresh signed token from the server for every 30-second window. */
function useLiveToken() {
  const [token, setToken] = useState<{ token: string; expiresAt: number } | null>(null);
  const [svg, setSvg] = useState("");
  const [secs, setSecs] = useState(30);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const refresh = () =>
      api<{ token: string; expiresAt: string }>("/pass/token")
        .then(async (t) => {
          const next = { token: t.token, expiresAt: Date.parse(t.expiresAt) };
          const qr = await QRCode.toString(t.token, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
          if (cancelled) return;
          setToken(next);
          setSvg(qr);
          setError(null);
          timer = setTimeout(refresh, Math.max(500, next.expiresAt - Date.now() + 150));
        })
        .catch((e) => {
          if (cancelled) return;
          setError((e as Error).message);
          timer = setTimeout(refresh, 5000);
        });
    refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => token && setSecs(Math.max(0, Math.ceil((token.expiresAt - Date.now()) / 1000))), 250);
    return () => clearInterval(i);
  }, [token]);

  return { token: token?.token, svg, secs, error };
}

function LiveQr({ info }: { info: PassInfo }) {
  const { token, svg, secs, error } = useLiveToken();
  const [full, setFull] = useState(false);
  const timer = `0:${String(secs).padStart(2, "0")}`;

  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  return (
    <>
      <PassCard skin={info.cardSkin} name={shortName(info.name)} meta={info.institution.name} maxWidth={500}
        middle={
          <>
            <div className="qr-wrap">
              <svg className="ring" viewBox="0 0 250 250" aria-hidden="true">
                <circle cx="125" cy="125" r="120" stroke="rgba(127,127,140,.25)" />
                <circle className="ring-c" cx="125" cy="125" r="120" strokeLinecap="round" style={{ strokeDasharray: `${((RING * secs) / 30).toFixed(1)} ${RING.toFixed(1)}` }} />
              </svg>
              <div className="qr-box" role="img" aria-label="Your rotating Student Pass QR code" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center" }}>
              <span className="timer">{timer}</span><span className="meta">· token only, no personal data</span>
            </div>
          </>
        } />
      {error && <div className="form-error" style={{ maxWidth: 500, width: "100%" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 500 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setFull(true)}><Icon name="i-expand" size={18} />Full-screen scan</button>
        {process.env.NODE_ENV !== "production" && token && (
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(token).then(() => toast("Code copied. Paste it into the POS"))}>
            Copy code (dev)
          </button>
        )}
      </div>

      <div className={`fs${full ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Full-screen pass" aria-hidden={!full}>
        <button className="icon-btn close" onClick={() => setFull(false)} aria-label="Close full-screen pass"><Icon name="i-x" /></button>
        <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span className="status-dot" />Verified · show to the cashier</span>
        <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="timer" style={{ fontSize: 18 }}>{timer}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600 }}>{shortName(info.name)}</span>
      </div>
    </>
  );
}

function SkinPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  async function pick(id: string) {
    const prev = value;
    onChange(id);
    try {
      await api("/pass", { method: "PATCH", json: { cardSkin: id } });
    } catch {
      onChange(prev);
      toast("Couldn’t change the card colour");
    }
  }
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 className="h-card">Pass colour</h3>
      <div className="skins" role="radiogroup" aria-label="Pass colour">
        {SKINS.map((k) => (
          <button key={k.id} className="skin" role="radio" aria-label={k.name} aria-checked={value === k.id} onClick={() => pick(k.id)} style={{ background: k.swatch }} />
        ))}
      </div>
    </div>
  );
}

function FreezeSwitch({ frozen, onChange }: { frozen: boolean; onChange: (f: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      const r = await api<{ passState: "ACTIVE" | "FROZEN" }>("/pass/freeze", { method: "POST", json: { frozen: !frozen } });
      onChange(r.passState === "FROZEN");
      toast(r.passState === "FROZEN" ? "Pass frozen. Scans will be declined" : "Pass unfrozen");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
      <div><b>Freeze my pass</b><div className="tiny">{frozen ? "Frozen: all scans are declined" : "Lost your phone? Freeze it instantly"}</div></div>
      <button className="switch" role="switch" aria-label="Freeze pass" aria-checked={frozen} disabled={busy} onClick={toggle} />
    </div>
  );
}
