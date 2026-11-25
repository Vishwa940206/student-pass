"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiFailure, formatLkr } from "@/lib/client";
import { fmtDate } from "@/lib/format";

interface Data {
  branding: { displayName: string; shortName: string; logoUrl: string | null; brandColor: string | null };
  invoice: { number: string; item: string; amountCents: number; dueDate: string; status: string };
  student: string;
  payOnline: boolean;
}

/** Family pay link: someone pays a student's invoice without an account. */
export function PayView() {
  const { token } = useParams<{ token: string }>();
  const done = useSearchParams().get("done");
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Data>(`/public/pay/${encodeURIComponent(token)}`).then(setD).catch((e) => setMissing((e as Error).message)); }, [token]);

  if (missing) return <div className="empty">{missing}</div>;
  if (!d) return <p className="muted">Loading…</p>;
  const b = d.branding, i = d.invoice;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", ...(b.brandColor ? { ["--brand" as string]: b.brandColor } : {}) }}>
      <div className="card panel">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.logoUrl ? <img src={b.logoUrl} alt="" className="inst-logo" style={{ width: 52, height: 52 }} /> : <span className="inst-logo brand-initials" style={{ width: 52, height: 52 }}>{b.shortName.slice(0, 3)}</span>}
          <div><span className="eyebrow">{b.displayName}</span><h1 className="h-card" style={{ margin: 0 }}>Pay {d.student}’s fee</h1></div>
        </div>
        <div className="list-row"><span>{i.item}</span><b>{formatLkr(i.amountCents)}</b></div>
        <div className="tiny">{i.number} · due {fmtDate(i.dueDate)}</div>
        {i.status !== "DUE" ? (
          <div className="card panel" style={{ background: "color-mix(in oklab, var(--mint) 18%, var(--surface))" }}><b>This fee has been paid. Thank you.</b></div>
        ) : done ? (
          <div className="card panel" style={{ background: "color-mix(in oklab, var(--mint) 18%, var(--surface))" }}><b>Thank you.</b><span className="small">We’re confirming the payment with the bank. {d.student} will see it in Student Pass within a minute.</span></div>
        ) : d.payOnline ? (
          <form style={{ display: "flex", flexDirection: "column", gap: 10 }} noValidate onSubmit={async (e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            setBusy(true); setError(null);
            try {
              const r = await api<{ action: string; fields: Record<string, string> }>(`/public/pay/${encodeURIComponent(token)}/checkout`, { method: "POST", json: { name: v("name"), email: v("email"), phone: v("phone") } });
              const form = document.createElement("form"); form.method = "POST"; form.action = r.action;
              for (const [k, val] of Object.entries(r.fields)) { const inp = document.createElement("input"); inp.type = "hidden"; inp.name = k; inp.value = val; form.appendChild(inp); }
              document.body.appendChild(form); form.submit();
            } catch (err) { const fe = err as ApiFailure; setError(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); setBusy(false); }
          }}>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="field"><label htmlFor="p-name">Your name</label><input className="input" id="p-name" name="name" required autoComplete="name" /></div>
            <div className="field"><label htmlFor="p-email">Email for the receipt</label><input className="input" id="p-email" name="email" type="email" required autoComplete="email" /></div>
            <div className="field"><label htmlFor="p-phone">Mobile</label><input className="input" id="p-phone" name="phone" type="tel" required autoComplete="tel" /></div>
            <button className="btn btn-mint btn-block" disabled={busy}>{busy ? "Opening secure payment…" : `Pay ${formatLkr(i.amountCents)} by card`}</button>
            <span className="tiny">Secure card payment by PayHere. Your card details go straight to PayHere, never to Student Pass or {b.shortName}.</span>
          </form>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Online payment isn’t available for {b.displayName} yet. Please pay at their finance office.</p>
        )}
      </div>
    </div>
  );
}
