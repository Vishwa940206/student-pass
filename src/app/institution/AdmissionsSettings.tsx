"use client";
import { useCallback, useEffect, useState } from "react";
import { api, formatLkr, toast } from "@/lib/client";
import { relDays } from "@/lib/format";
import { APP_STATUSES, label, STUDY_MODES } from "@/lib/os/labels";
import { submit } from "./InstitutionView";
import { ApplicationControl, type Programme } from "./CrmPanel";

interface AppRow {
  id: string; status: string; intake: string; statusAt: string; createdAt: string;
  programme: { id: string; name: string };
  lead: { id: string; name: string; phone: string | null; email: string | null; counsellor: { name: string } | null };
}

const ACTIVE = ["UNDER_REVIEW", "OFFER_ISSUED", "ACCEPTED", "DEPOSIT_PAID", "ENROLLED"] as const;

export function AdmissionsPanel({ initial }: { initial?: Record<string, string> }) {
  const [rows, setRows] = useState<AppRow[] | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programme, setProgramme] = useState("");
  const [intake, setIntake] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const focus = initial?.status;

  const load = useCallback(() => {
    const qs = new URLSearchParams({ ...(programme && { programme }), ...(intake && { intake }) }).toString();
    api<{ applications: AppRow[] }>(`/institution/applications?${qs}`).then((r) => setRows(r.applications)).catch((e) => toast(e.message));
  }, [programme, intake]);
  useEffect(load, [load]);
  useEffect(() => { api<{ programmes: Programme[] }>("/institution/programmes").then((r) => setProgrammes(r.programmes)).catch(() => {}); }, []);

  const columns = showClosed ? [...ACTIVE, "REJECTED", "WITHDRAWN"] : ACTIVE;
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <select className="select" value={programme} onChange={(e) => setProgramme(e.target.value)} aria-label="Programme"><option value="">All programmes</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="select" value={intake} onChange={(e) => setIntake(e.target.value)} aria-label="Intake"><option value="">All intakes</option>{[...new Set(programmes.flatMap((p) => p.intakes))].map((i) => <option key={i}>{i}</option>)}</select>
        <label className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show rejected and withdrawn</label>
      </div>
      {!rows ? <p className="muted">Loading…</p> : (
        <div className="board">
          {columns.map((s) => {
            const col = rows.filter((r) => r.status === s);
            return (
              <div key={s} className={`board-col${focus === s ? " focus" : ""}`}>
                <div className="row"><b className="small">{label(APP_STATUSES, s as never)}</b><span className="tag soft">{col.length}</span></div>
                {col.map((r) => (
                  <div key={r.id} className="card board-card">
                    <b>{r.lead.name}</b>
                    <div className="meta">{r.programme.name}</div>
                    <div className="meta">{r.lead.counsellor?.name ?? "Unassigned"} · in this stage {relDays(r.statusAt).replace(" ago", "")}</div>
                    <ApplicationControl app={r} reload={load} />
                  </div>
                ))}
                {!col.length && <div className="tiny" style={{ padding: 8 }}>None</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

interface Branding { slug: string; name: string; displayName: string; tagline: string | null; brandColor: string | null; logoUrl: string | null }

export function SettingsPanel({ onBrandingChange }: { onBrandingChange: () => void }) {
  const [b, setB] = useState<Branding | null>(null);
  const [programmes, setProgrammes] = useState<Programme[] | null>(null);
  const [color, setColor] = useState("#12C16E");
  const [saving, setSaving] = useState(false);

  const loadProgrammes = useCallback(() => { api<{ programmes: Programme[] }>("/institution/programmes").then((r) => setProgrammes(r.programmes)).catch((e) => toast(e.message)); }, []);
  useEffect(() => {
    api<Branding>("/institution/branding").then((r) => { setB(r); if (r.brandColor) setColor(r.brandColor); }).catch((e) => toast(e.message));
    loadProgrammes();
  }, [loadProgrammes]);

  async function saveBranding(json: Record<string, unknown>, ok: string) {
    setSaving(true);
    try {
      const r = await api<Branding>("/institution/branding", { method: "PATCH", json });
      setB(r); toast(ok); onBrandingChange();
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  }

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 256 * 1024) return toast("Logo must be 256 KB or smaller");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast("Use a PNG, JPEG or WebP image");
    const reader = new FileReader();
    reader.onload = () => saveBranding({ logo: reader.result }, "Logo updated");
    reader.readAsDataURL(file);
  }

  if (!b) return <p className="muted">Loading settings…</p>;
  const link = typeof window !== "undefined" ? `${window.location.origin}/enquire/${b.slug}` : `/enquire/${b.slug}`;

  return (
    <div className="panel-grid">
      <form className="card panel" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        saveBranding({ displayName: String(f.get("displayName")).trim() || null, tagline: String(f.get("tagline")).trim() || null, brandColor: color }, "Branding saved");
      }}>
        <h3 className="h-card">White-label branding</h3>
        <p className="muted small" style={{ margin: 0 }}>Shown across your portal, your students’ Campus Life and your public enquiry page.</p>
        <div className="brand-preview" style={{ ["--brand" as string]: color }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.logoUrl ? <img src={b.logoUrl} alt="" /> : <span className="brand-initials">{b.displayName.slice(0, 2).toUpperCase()}</span>}
          <div><b>{b.displayName}</b><div className="tiny">{b.tagline ?? "Your tagline"}</div></div>
        </div>
        <div className="field"><label htmlFor="b-name">Display name</label><input className="input" id="b-name" name="displayName" defaultValue={b.displayName === b.name ? "" : b.displayName} placeholder={b.name} maxLength={80} /></div>
        <div className="field"><label htmlFor="b-tag">Tagline</label><input className="input" id="b-tag" name="tagline" defaultValue={b.tagline ?? ""} maxLength={160} /></div>
        <div className="field"><label htmlFor="b-col">Brand colour</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" id="b-col" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} style={{ width: 52, height: 44, border: 0, background: "none" }} />
            <input className="input" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Hex colour" style={{ maxWidth: 140 }} />
          </div></div>
        <div className="field"><label htmlFor="b-logo">Logo (PNG, JPEG or WebP, up to 256 KB)</label>
          <input id="b-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} />
          {b.logoUrl && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => saveBranding({ logo: null }, "Logo removed")}>Remove logo</button>}
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save branding"}</button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card panel">
          <h3 className="h-card">Public enquiry page</h3>
          <p className="muted small" style={{ margin: 0 }}>Share this link on your website, Instagram bio or WhatsApp. Enquiries land in the CRM and go to the least-busy counsellor.</p>
          <div className="secret" style={{ fontSize: 14 }}>{link}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied"))}>Copy link</button>
            <a className="btn btn-ghost btn-sm" href={`/enquire/${b.slug}`} target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>

        <div className="card panel">
          <h3 className="h-card">Programmes</h3>
          {programmes?.map((p) => (
            <div key={p.id} className="list-row">
              <div><b>{p.name}</b><div className="meta">{label(STUDY_MODES, p.mode as never)}{p.durationMonths ? ` · ${p.durationMonths} months` : ""}{p.feeCents ? ` · ${formatLkr(p.feeCents)}/yr` : ""} · intakes {p.intakes.join(", ") || "—"}</div>
                <div className="meta">{p.leads} enquiries · {p.applications} applications</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => submit(`/institution/programmes/${p.id}`, { open: !p.open }, p.open ? "Closed to enquiries" : "Opened", loadProgrammes, "PATCH")}>{p.open ? "Close" : "Open"}</button>
            </div>
          ))}
          <form style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }} onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            const fee = String(f.get("fee") ?? "").replace(/[^\d.]/g, "");
            const ok = await submit("/institution/programmes", {
              name: String(f.get("name")).trim(), mode: f.get("mode"),
              durationMonths: Number(f.get("months")) || null, feeCents: fee ? Math.round(Number(fee) * 100) : null,
              intakes: String(f.get("intakes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            }, "Programme added", loadProgrammes);
            if (ok) form.reset();
          }}>
            <b className="small">Add a programme</b>
            <div className="form-grid">
              <div className="field full"><label htmlFor="p-name">Name</label><input className="input" id="p-name" name="name" required minLength={2} placeholder="BSc (Hons) Computing" /></div>
              <div className="field"><label htmlFor="p-mode">Mode</label><select className="select" id="p-mode" name="mode">{STUDY_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="field"><label htmlFor="p-m">Duration (months)</label><input className="input" id="p-m" name="months" type="number" min={1} max={120} /></div>
              <div className="field"><label htmlFor="p-fee">Fee per year (LKR)</label><input className="input" id="p-fee" name="fee" inputMode="decimal" /></div>
              <div className="field"><label htmlFor="p-int">Intakes (comma-separated)</label><input className="input" id="p-int" name="intakes" placeholder="Jan 2027, May 2027" /></div>
            </div>
            <button className="btn btn-primary btn-sm">Add programme</button>
          </form>
        </div>
      </div>
    </div>
  );
}
