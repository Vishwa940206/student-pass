"use client";
import { useCallback, useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { fmtDate, fmtDateTime, relDays } from "@/lib/format";
import { ACTIVITY_KINDS, APP_STATUSES, DISTRICTS, label, LEAD_SOURCES, LEAD_STAGES, stageIndex, type LeadStage } from "@/lib/os/labels";
import { remove, submit, type StaffMember } from "./InstitutionView";

export interface Programme { id: string; name: string; open: boolean; intakes: string[]; mode: string; durationMonths: number | null; feeCents: number | null; leads?: number; applications?: number }
interface LeadRow {
  id: string; name: string; phone: string | null; email: string | null; district: string | null; source: string; stage: LeadStage;
  lostAt: string | null; lostReason: string | null; lastActivityAt: string; createdAt: string;
  programme: { id: string; name: string } | null; counsellor: { id: string; name: string } | null;
  application: { id: string; status: string; intake: string } | null;
}
interface LeadDetail extends LeadRow {
  activities: { id: string; kind: string; body: string; createdAt: string; author: { name: string } | null }[];
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function CrmPanel({ staff, meId, isAdmin, initial }: { staff: StaffMember[]; meId: string; isAdmin: boolean; initial?: Record<string, string> }) {
  const [filters, setFilters] = useState<Record<string, string>>({ status: "open", ...initial });
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    api<{ leads: LeadRow[] }>(`/institution/leads?${qs}`).then((r) => setLeads(r.leads)).catch((e) => toast(e.message));
  }, [filters]);
  useEffect(load, [load]);
  useEffect(() => { api<{ programmes: Programme[] }>("/institution/programmes").then((r) => setProgrammes(r.programmes)).catch(() => {}); }, []);

  const counsellors = staff.filter((s) => s.staffRole !== "LECTURER");
  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  if (openId) return <LeadView id={openId} back={() => { setOpenId(null); load(); }} programmes={programmes} counsellors={counsellors} meId={meId} isAdmin={isAdmin} />;

  return (
    <>
      <div className="toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input className="input" placeholder="Search name, phone, email" style={{ flex: "1 1 220px" }} defaultValue={filters.q ?? ""}
          onKeyDown={(e) => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value); }} aria-label="Search enquiries" />
        <select className="select" value={filters.stage ?? ""} onChange={(e) => set("stage", e.target.value)} aria-label="Stage">
          <option value="">All stages</option>{LEAD_STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="select" value={filters.source ?? ""} onChange={(e) => set("source", e.target.value)} aria-label="Source">
          <option value="">All sources</option>{LEAD_SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="select" value={filters.counsellor ?? ""} onChange={(e) => set("counsellor", e.target.value)} aria-label="Counsellor">
          <option value="">Everyone</option><option value="me">Mine</option><option value="none">Unassigned</option>
          {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={filters.status ?? "open"} onChange={(e) => set("status", e.target.value)} aria-label="Open or lost">
          <option value="open">Open</option><option value="lost">Lost</option><option value="all">All</option>
        </select>
        {filters.idleDays && <button className="btn btn-ghost btn-sm" onClick={() => set("idleDays", "")}>Quiet {filters.idleDays}+ days ×</button>}
        <button className="btn btn-primary btn-sm" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "+ Add enquiry"}</button>
      </div>

      {adding && (
        <form className="card panel" style={{ marginBottom: 16 }} onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          const ok = await submit("/institution/leads", {
            name: str(f, "name"), phone: str(f, "phone") || null, email: str(f, "email") || null, district: str(f, "district") || null,
            source: str(f, "source"), programmeId: str(f, "programmeId") || null, consent: f.get("consent") === "on", note: str(f, "note") || null,
            ...(isAdmin && { counsellorId: str(f, "counsellorId") || null }),
          }, "Enquiry added", () => { setAdding(false); load(); });
          if (ok) form.reset();
        }}>
          <h3 className="h-card">New enquiry</h3>
          <div className="form-grid">
            <div className="field"><label htmlFor="l-name">Name</label><input className="input" id="l-name" name="name" required minLength={2} /></div>
            <div className="field"><label htmlFor="l-src">Source</label><select className="select" id="l-src" name="source" defaultValue="WALK_IN">{LEAD_SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="l-phone">Phone</label><input className="input" id="l-phone" name="phone" type="tel" /></div>
            <div className="field"><label htmlFor="l-email">Email</label><input className="input" id="l-email" name="email" type="email" /></div>
            <div className="field"><label htmlFor="l-prog">Interested in</label><select className="select" id="l-prog" name="programmeId" defaultValue=""><option value="">Undecided</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="l-dist">District</label><select className="select" id="l-dist" name="district" defaultValue=""><option value="">—</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></div>
            {isAdmin && <div className="field"><label htmlFor="l-c">Counsellor</label><select className="select" id="l-c" name="counsellorId" defaultValue=""><option value="">Unassigned</option>{counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            <div className="field full"><label htmlFor="l-note">First note (optional)</label><textarea className="input" id="l-note" name="note" style={{ minHeight: 70 }} /></div>
            <label className="small full" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="consent" /> They agreed to be contacted</label>
          </div>
          <button className="btn btn-primary">Add enquiry</button>
        </form>
      )}

      <div className="card panel">
        <h3 className="h-card">{leads ? `${leads.length} ${leads.length === 1 ? "enquiry" : "enquiries"}` : "Loading…"}</h3>
        {leads?.map((l) => (
          <button key={l.id} className="list-row lead-row" onClick={() => setOpenId(l.id)}>
            <div style={{ textAlign: "left" }}>
              <b>{l.name}</b>
              <div className="meta">{l.programme?.name ?? "Undecided"} · {label(LEAD_SOURCES, l.source as never)}{l.district ? ` · ${l.district}` : ""}</div>
              <div className="meta">{l.counsellor?.name ?? "Unassigned"} · last activity {relDays(l.lastActivityAt)}</div>
            </div>
            <span className="tag" style={{ background: l.lostAt ? "var(--surface-2)" : stageTone(l.stage) }}>{l.lostAt ? "Lost" : label(LEAD_STAGES, l.stage)}</span>
          </button>
        ))}
        {leads && !leads.length && <p className="muted small" style={{ margin: 0 }}>No enquiries match.</p>}
      </div>
    </>
  );
}

export const stageTone = (s: LeadStage) => ["var(--surface-2)", "var(--cyan)", "var(--lilac)", "var(--sun)", "var(--coral)", "var(--mint)"][stageIndex(s)];

function LeadView({ id, back, programmes, counsellors, meId, isAdmin }: { id: string; back: () => void; programmes: Programme[]; counsellors: StaffMember[]; meId: string; isAdmin: boolean }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const load = useCallback(() => { api<{ lead: LeadDetail }>(`/institution/leads/${id}`).then((r) => setLead(r.lead)).catch((e) => toast(e.message)); }, [id]);
  useEffect(load, [load]);
  if (!lead) return <p className="muted">Loading…</p>;

  const patch = (json: unknown, ok: string) => submit(`/institution/leads/${id}`, json, ok, load, "PATCH");
  const canAssign = isAdmin || !lead.counsellor || lead.counsellor.id === meId;
  const prog = programmes.find((p) => p.id === lead.programme?.id);

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={back}>← All enquiries</button>
        <h2 className="h-card" style={{ margin: 0 }}>{lead.name}</h2>
        <span className="tag" style={{ background: lead.lostAt ? "var(--surface-2)" : stageTone(lead.stage) }}>{lead.lostAt ? `Lost · ${lead.lostReason}` : label(LEAD_STAGES, lead.stage)}</span>
        <span style={{ flex: 1 }} />
        {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/leads/${id}`, `${lead.name} and their history`, back)}>Delete</button>}
      </div>

      <div className="panel-grid">
        <div className="card panel">
          <h3 className="h-card">Details</h3>
          <div className="small">{lead.phone && <>📞 <a href={`tel:${lead.phone}`}>{lead.phone}</a> · <a href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "94")}`} target="_blank" rel="noreferrer">WhatsApp</a><br /></>}
            {lead.email && <>✉️ <a href={`mailto:${lead.email}`}>{lead.email}</a><br /></>}
            {label(LEAD_SOURCES, lead.source as never)} · {lead.district ?? "District not set"} · since {fmtDate(lead.createdAt)}</div>
          <div className="form-grid">
            <div className="field"><label htmlFor="d-prog">Programme</label>
              <select className="select" id="d-prog" value={lead.programme?.id ?? ""} disabled={!!lead.application} onChange={(e) => patch({ programmeId: e.target.value || null }, "Programme updated")}>
                <option value="">Undecided</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="d-c">Counsellor</label>
              <select className="select" id="d-c" value={lead.counsellor?.id ?? ""} disabled={!canAssign} onChange={(e) => patch({ counsellorId: e.target.value || null }, "Assigned")}>
                <option value="">Unassigned</option>{counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            {!lead.application && !lead.lostAt && (
              <div className="field"><label htmlFor="d-st">Stage</label>
                <select className="select" id="d-st" value={lead.stage} onChange={(e) => patch({ stage: e.target.value }, "Stage updated")}>
                  {LEAD_STAGES.slice(0, 3).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
            )}
          </div>
          {lead.lostAt
            ? <button className="btn btn-ghost btn-sm" onClick={() => patch({ reopen: true }, "Reopened")}>Reopen</button>
            : !lead.application && <button className="btn btn-ghost btn-sm" onClick={() => {
                const reason = window.prompt("Why is this enquiry lost? (e.g. chose another institution)");
                if (reason && reason.trim().length >= 2) patch({ lost: { reason: reason.trim() } }, "Marked lost");
              }}>Mark lost</button>}

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <h3 className="h-card" style={{ marginBottom: 10 }}>Application</h3>
            {lead.application ? (
              <ApplicationControl app={lead.application} reload={load} />
            ) : lead.lostAt ? <p className="muted small" style={{ margin: 0 }}>Reopen to apply.</p> : (
              <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }} onSubmit={async (e) => {
                e.preventDefault(); const f = new FormData(e.currentTarget);
                await submit(`/institution/leads/${id}/application`, { programmeId: str(f, "programmeId"), intake: str(f, "intake") }, "Application created", load);
              }}>
                <div className="field" style={{ flex: "1 1 200px" }}><label htmlFor="ap-p">Programme</label>
                  <select className="select" id="ap-p" name="programmeId" defaultValue={prog?.open ? prog.id : ""} required>
                    <option value="" disabled>Choose…</option>{programmes.filter((p) => p.open).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div className="field" style={{ flex: "1 1 120px" }}><label htmlFor="ap-i">Intake</label>
                  <input className="input" id="ap-i" name="intake" list="intakes" defaultValue={prog?.intakes[0] ?? ""} required />
                  <datalist id="intakes">{[...new Set(programmes.flatMap((p) => p.intakes))].map((i) => <option key={i} value={i} />)}</datalist></div>
                <button className="btn btn-mint btn-sm">Create application</button>
              </form>
            )}
          </div>
        </div>

        <div className="card panel">
          <h3 className="h-card">Timeline</h3>
          <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={async (e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            if (await submit(`/institution/leads/${id}/activities`, { kind: str(f, "kind"), body: str(f, "body") }, "Logged", load)) form.reset();
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="select" name="kind" defaultValue="CALL" aria-label="Activity type" style={{ maxWidth: 150 }}>{ACTIVITY_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input className="input" name="body" required placeholder="What happened?" aria-label="Activity" style={{ flex: 1 }} />
            </div>
            <button className="btn btn-primary btn-sm">Log</button>
          </form>
          {lead.activities.map((a) => (
            <div key={a.id} className="list-row">
              <div><span className="tag soft" style={{ fontSize: 11 }}>{a.kind === "STAGE" ? "Stage" : a.kind === "SYSTEM" ? "System" : label(ACTIVITY_KINDS, a.kind as never)}</span>
                <div style={{ marginTop: 6, whiteSpace: "pre-line" }}>{a.body}</div>
                <div className="meta">{a.author?.name ?? "Website"} · {fmtDateTime(a.createdAt)}</div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ApplicationControl({ app, reload }: { app: { id: string; status: string; intake: string }; reload: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="small">Intake {app.intake}</span>
      <select className="select" value={app.status} aria-label="Application status" style={{ maxWidth: 200 }}
        onChange={(e) => submit(`/institution/applications/${app.id}`, { status: e.target.value }, "Application updated", reload, "PATCH")}>
        {APP_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
