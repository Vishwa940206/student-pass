"use client";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { label, LEAD_SOURCES, LEAD_STAGES } from "@/lib/os/labels";

/** Horizontal bar with label and value (no chart library needed). */
export function Bar({ label: l, value, max, sub, tone = "var(--brand, var(--mint))" }: { label: string; value: number; max: number; sub?: string; tone?: string }) {
  const pct = max ? Math.max(2, Math.round((100 * value) / max)) : 0;
  return (
    <div className="osb-row">
      <div className="osb-label"><span>{l}</span><b>{value}</b></div>
      <div className="osb-track"><div className="osb-fill" style={{ width: `${pct}%`, background: tone }} /></div>
      {sub && <div className="tiny">{sub}</div>}
    </div>
  );
}

const delta = (v: number, prev: number) => {
  if (!prev) return v ? "new this week" : "no change";
  const d = Math.round((100 * (v - prev)) / prev);
  return `${d > 0 ? "▲" : d < 0 ? "▼" : "•"} ${Math.abs(d)}% vs last week`;
};

export type Go = (tab: string, filter?: Record<string, string>) => void;

interface Brain {
  role: "ADMIN" | "LECTURER" | "COUNSELLOR";
  kpis: { enquiries: { value: number; prev: number }; applications: { value: number; prev: number }; enrolled: { value: number; prev: number }; openLeads: number; verified: number; pending: number };
  actions: { id: string; tone: "urgent" | "soon" | "info"; title: string; detail: string; count: number; tab: string; filter?: Record<string, string> }[];
}

export function BrainPanel({ go }: { go: Go }) {
  const [d, setD] = useState<Brain | null>(null);
  useEffect(() => { api<Brain>("/institution/brain").then(setD).catch((e) => toast(e.message)); }, []);
  if (!d) return <p className="muted">Reading across your records…</p>;
  const k = d.kpis;
  const admissions = d.role !== "LECTURER";
  return (
    <>
      <div className="kpis">
        {admissions && <>
          <div className="stat"><span className="tiny">New enquiries · 7 days</span><b>{k.enquiries.value}</b><span className="tiny">{delta(k.enquiries.value, k.enquiries.prev)}</span></div>
          <div className="stat"><span className="tiny">Applications · 7 days</span><b>{k.applications.value}</b><span className="tiny">{delta(k.applications.value, k.applications.prev)}</span></div>
          <div className="stat"><span className="tiny">Enrolled · 7 days</span><b>{k.enrolled.value}</b><span className="tiny">{delta(k.enrolled.value, k.enrolled.prev)}</span></div>
          <div className="stat"><span className="tiny">Open enquiries</span><b>{k.openLeads}</b></div>
        </>}
        <div className="stat"><span className="tiny">Verified students</span><b>{k.verified}</b></div>
        {d.role === "ADMIN" && <div className="stat"><span className="tiny">Waiting for verification</span><b>{k.pending}</b></div>}
      </div>
      <div className="card panel">
        <div className="row"><h3 className="h-card">Next best actions</h3><span className="tiny">Worked out from your live records</span></div>
        {d.actions.length ? d.actions.map((a) => (
          <div key={a.id} className="list-row">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className={`tone-dot ${a.tone}`} aria-hidden />
              <div><b>{a.title}</b><div className="meta">{a.detail}</div></div>
            </div>
            <button className="btn btn-mint btn-sm" onClick={() => go(a.tab, a.filter)}>Open</button>
          </div>
        )) : <p className="muted small" style={{ margin: 0 }}>Nothing needs you right now. Everything is followed up.</p>}
      </div>
    </>
  );
}

interface Analytics {
  days: number;
  funnel: { stage: string; count: number }[];
  weekly: { week: string; enquiries: number; applications: number }[];
  sources: { source: string; total: number; contacted: number; applied: number; enrolled: number }[];
  counsellors: { id: string | null; name: string; total: number; contacted: number; applied: number; enrolled: number }[];
  campus: { verified: number; rsvps30: number; clubMembers: number; courses: { code: string; name: string; enrolled: number; graded: number; average: number | null }[] };
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");

export function AnalyticsPanel() {
  const [days, setDays] = useState(180);
  const [d, setD] = useState<Analytics | null>(null);
  useEffect(() => { api<Analytics>(`/institution/analytics?days=${days}`).then(setD).catch((e) => toast(e.message)); }, [days]);
  if (!d) return <p className="muted">Crunching numbers…</p>;
  const top = d.funnel[0]?.count ?? 0;
  const wmax = Math.max(1, ...d.weekly.map((w) => Math.max(w.enquiries, w.applications)));
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="muted small">Enquiries created in the last {days} days</span>
        <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" style={{ maxWidth: 180 }}>
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={180}>Last 6 months</option><option value={365}>Last 12 months</option>
        </select>
      </div>
      <div className="panel-grid">
        <div className="card panel">
          <h3 className="h-card">Enquiry → enrolment funnel</h3>
          {d.funnel.map((f) => <Bar key={f.stage} label={label(LEAD_STAGES, f.stage as never)} value={f.count} max={top} sub={`${pct(f.count, top)} of enquiries`} />)}
        </div>
        <div className="card panel">
          <h3 className="h-card">Enquiries and applications by week</h3>
          <div className="weekly" role="img" aria-label="Weekly enquiries and applications, last 12 weeks">
            {d.weekly.map((w) => (
              <div key={w.week} className="wk" title={`Week of ${fmtDate(w.week)}: ${w.enquiries} enquiries, ${w.applications} applications`}>
                <div className="wk-bars">
                  <div style={{ height: `${(100 * w.enquiries) / wmax}%`, background: "var(--brand, var(--mint))" }} />
                  <div style={{ height: `${(100 * w.applications) / wmax}%`, background: "var(--text)" }} />
                </div>
                <span>{new Date(w.week).getDate()}/{new Date(w.week).getMonth() + 1}</span>
              </div>
            ))}
          </div>
          <div className="tiny"><span className="key" style={{ background: "var(--brand, var(--mint))" }} /> Enquiries <span className="key" style={{ background: "var(--text)", marginLeft: 12 }} /> Applications</div>
        </div>
        <div className="card panel">
          <h3 className="h-card">Application rate by source</h3>
          {d.sources.map((s) => <Bar key={s.source} label={label(LEAD_SOURCES, s.source as never)} value={s.total} max={d.sources[0]?.total ?? 1} sub={`${pct(s.applied, s.total)} applied · ${s.enrolled} enrolled`} />)}
          {!d.sources.length && <p className="muted small">No enquiries in this period.</p>}
        </div>
        <div className="card panel">
          <h3 className="h-card">Counsellor conversion</h3>
          <table className="gradebook">
            <thead><tr><th>Counsellor</th><th>Leads</th><th>Contacted</th><th>Applied</th><th>Enrolled</th></tr></thead>
            <tbody>{d.counsellors.map((c) => (
              <tr key={c.id ?? "none"}><td>{c.name}</td><td>{c.total}</td><td>{pct(c.contacted, c.total)}</td><td>{pct(c.applied, c.total)}</td><td>{c.enrolled}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card panel">
          <h3 className="h-card">Campus engagement</h3>
          <div className="stats3">
            <div className="stat"><span className="tiny">Verified</span><b>{d.campus.verified}</b></div>
            <div className="stat"><span className="tiny">RSVPs · 30 days</span><b>{d.campus.rsvps30}</b></div>
            <div className="stat"><span className="tiny">Club members</span><b>{d.campus.clubMembers}</b></div>
          </div>
          {d.campus.courses.map((c) => (
            <div key={c.code} className="list-row"><div><b>{c.code}</b> · {c.name}<div className="meta">{c.enrolled} enrolled · {c.graded} grades</div></div><span className="tag soft">{c.average === null ? "No grades" : `Avg ${c.average}%`}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

interface Market {
  total: number;
  demand: { programmeId: string | null; name: string; count: number; prior: number }[];
  noEnquiries: string[];
  districts: { district: string; count: number }[];
  sources: { source: string; count: number }[];
  months: string[];
  trend: { name: string; points: number[] }[];
}

export function MarketPanel() {
  const [d, setD] = useState<Market | null>(null);
  useEffect(() => { api<Market>("/institution/market").then(setD).catch((e) => toast(e.message)); }, []);
  if (!d) return <p className="muted">Reading demand…</p>;
  const max = d.demand[0]?.count ?? 1;
  const tmax = Math.max(1, ...d.trend.flatMap((t) => t.points));
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>From {d.total} enquiries in the last 90 days, compared with the 90 days before.</p>
      <div className="panel-grid">
        <div className="card panel">
          <h3 className="h-card">Demand by programme</h3>
          {d.demand.map((p) => {
            const ch = p.prior ? Math.round((100 * (p.count - p.prior)) / p.prior) : null;
            return <Bar key={p.name} label={p.name} value={p.count} max={max} sub={ch === null ? (p.count ? "New demand" : "") : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch)}% vs prior 90 days`} />;
          })}
          {d.noEnquiries.length > 0 && <div className="tiny">No recent enquiries: {d.noEnquiries.join(", ")}</div>}
        </div>
        <div className="card panel">
          <h3 className="h-card">Where demand comes from</h3>
          {d.districts.map((x) => <Bar key={x.district} label={x.district} value={x.count} max={d.districts[0]?.count ?? 1} tone="var(--cyan)" />)}
          {!d.districts.length && <p className="muted small">No districts recorded yet.</p>}
        </div>
        <div className="card panel">
          <h3 className="h-card">Channels</h3>
          {d.sources.map((x) => <Bar key={x.source} label={label(LEAD_SOURCES, x.source as never)} value={x.count} max={d.sources[0]?.count ?? 1} tone="var(--lilac)" />)}
        </div>
        <div className="card panel">
          <h3 className="h-card">6-month trend · top programmes</h3>
          {d.trend.map((t) => (
            <div key={t.name}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
              <div className="spark">{t.points.map((v, i) => <div key={i} title={`${new Date(d.months[i]).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}: ${v}`} style={{ height: `${Math.max(4, (100 * v) / tmax)}%` }} />)}</div>
            </div>
          ))}
          <div className="tiny">{d.months.map((m) => new Date(m).toLocaleDateString("en-GB", { month: "short" })).join(" · ")}</div>
        </div>
      </div>
    </>
  );
}
