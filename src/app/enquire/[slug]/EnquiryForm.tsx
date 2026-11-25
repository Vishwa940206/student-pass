"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiFailure, formatLkr } from "@/lib/client";
import { DISTRICTS, label, STUDY_MODES } from "@/lib/os/labels";
import { Chat } from "@/components/Chat";

interface Data {
  assistant: boolean;
  branding: { displayName: string; tagline: string | null; brandColor: string | null; logoUrl: string | null; shortName: string };
  programmes: { id: string; name: string; mode: string; durationMonths: number | null; feeCents: number | null; intakes: string[] }[];
}

/** An institution's public, white-labelled enquiry page. Submissions become CRM leads. */
export function EnquiryForm() {
  const { slug } = useParams<{ slug: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api<Data>(`/public/institutions/${encodeURIComponent(slug)}`).then(setD).catch(() => setMissing(true));
  }, [slug]);

  if (missing) return <div className="empty">We couldn’t find that institution.</div>;
  if (!d) return <p className="muted">Loading…</p>;
  const b = d.branding;

  return (
    <div style={b.brandColor ? ({ ["--brand" as string]: b.brandColor }) : undefined}>
      <div className="sec-head">
        <div className="l" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {b.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={b.logoUrl} alt="" className="inst-logo" />
            : <span className="inst-logo brand-initials">{b.shortName.slice(0, 3)}</span>}
          <div>
            <span className="eyebrow">{b.tagline ?? "Admissions"}</span>
            <h1 className="h-sec page-title" style={{ margin: 0 }}>{b.displayName}.</h1>
          </div>
        </div>
        <p className="r">Tell us what you’d like to study and a counsellor will get back to you.</p>
      </div>

      <div className="panel-grid">
        {sent ? (
          <div className="card panel" style={{ background: "color-mix(in oklab, var(--brand, var(--mint)) 16%, var(--surface))" }}>
            <h2 className="h-card">Thanks, we’ve got your enquiry.</h2>
            <p style={{ margin: 0 }}>A counsellor from {b.displayName} will contact you soon.</p>
          </div>
        ) : (
          <form className="card panel" noValidate onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const v = (k: string) => String(f.get(k) ?? "").trim();
            setBusy(true); setError(null);
            try {
              await api(`/public/institutions/${encodeURIComponent(slug)}/enquiries`, {
                method: "POST",
                json: { name: v("name"), phone: v("phone"), email: v("email"), district: v("district"), programmeId: v("programmeId"), message: v("message"), consent: f.get("consent") === "on", website: v("website") },
              });
              setSent(true);
            } catch (err) {
              const fe = err as ApiFailure;
              setError(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message);
            } finally { setBusy(false); }
          }}>
            <h2 className="h-card">Enquire</h2>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="form-grid">
              <div className="field full"><label htmlFor="q-name">Full name</label><input className="input" id="q-name" name="name" required autoComplete="name" /></div>
              <div className="field"><label htmlFor="q-phone">Mobile</label><input className="input" id="q-phone" name="phone" type="tel" autoComplete="tel" placeholder="07X XXX XXXX" /></div>
              <div className="field"><label htmlFor="q-email">Email</label><input className="input" id="q-email" name="email" type="email" autoComplete="email" /></div>
              <div className="field"><label htmlFor="q-prog">Interested in</label>
                <select className="select" id="q-prog" name="programmeId" defaultValue=""><option value="">Not sure yet</option>{d.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="field"><label htmlFor="q-dist">District</label>
                <select className="select" id="q-dist" name="district" defaultValue=""><option value="">—</option>{DISTRICTS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="field full"><label htmlFor="q-msg">Question (optional)</label><textarea className="input" id="q-msg" name="message" maxLength={2000} /></div>
              {/* Honeypot: hidden from people, filled in by bots. */}
              <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="q-web">Website</label><input id="q-web" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <label className="small full" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="checkbox" name="consent" style={{ marginTop: 3 }} />
                <span>I agree to {b.displayName} contacting me about my enquiry by phone, WhatsApp or email.</span>
              </label>
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {d.assistant && (
          <Chat endpoint={`/public/institutions/${encodeURIComponent(slug)}/chat`} title="Ask a question"
            greeting={`Hi! I can help with programmes, intakes, fees and scholarships at ${b.displayName}.`}
            suggestions={["When is the next intake?", "What are the fees?", "Do you offer scholarships?"]}
            handoverEndpoint={(cid) => `/public/institutions/${encodeURIComponent(slug)}/chat/${cid}/handover`} />
        )}
        <div className="card panel">
          <h3 className="h-card">Programmes</h3>
          {d.programmes.map((p) => (
            <div key={p.id} className="list-row">
              <div><b>{p.name}</b><div className="meta">{label(STUDY_MODES, p.mode as never)}{p.durationMonths ? ` · ${p.durationMonths} months` : ""}{p.feeCents ? ` · ${formatLkr(p.feeCents)} per year` : ""}</div>
                {p.intakes.length > 0 && <div className="meta">Intakes: {p.intakes.join(", ")}</div>}</div>
            </div>
          ))}
          {!d.programmes.length && <p className="muted small" style={{ margin: 0 }}>Programmes will be listed here soon.</p>}
        </div>
        </div>
      </div>
    </div>
  );
}
