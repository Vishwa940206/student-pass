"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { VerificationQueue } from "@/app/admin/VerificationQueue";
import { api, ApiFailure, toast } from "@/lib/client";
import { colomboIso, fmtDate, fmtDateTime } from "@/lib/format";
import { CoursesPanel } from "./CoursesPanel";
import { AnalyticsPanel, BrainPanel, MarketPanel } from "./InsightPanels";
import { CrmPanel } from "./CrmPanel";
import { AdmissionsPanel, SettingsPanel } from "./AdmissionsSettings";
import { AiPanel, FeesPanel, PaymentsSettings, ServicesPanel } from "./FinanceAiServices";
import { StaffPanel } from "./StaffPanel";

export type StaffRole = "ADMIN" | "LECTURER" | "COUNSELLOR";
export interface StaffMember { id: string; name: string; email: string; staffRole: StaffRole; createdAt: string }
export interface PortalCourse {
  id: string; code: string; name: string; enrolled: number; lecturer: { id: string; name: string } | null;
  assignments: { id: string; title: string; dueAt: string; maxMarks: number; graded: number }[];
}
export interface Portal {
  me: { id: string; name: string; staffRole: StaffRole };
  institution: { id: string; name: string; shortName: string; slug: string };
  branding: { displayName: string; tagline: string | null; brandColor: string | null; logoUrl: string | null };
  modules: string[];
  stats: { verified: number; pending: number; upcomingEvents: number; clubMembers: number; courses: number; enrolments: number };
  announcements: { id: string; title: string; body: string; pinned: boolean; createdAt: string; author: { name: string } }[];
  events: { id: string; title: string; description: string; location: string; startsAt: string; endsAt: string | null; capacity: number | null; going: number }[];
  clubs: { id: string; name: string; description: string; members: number }[];
  courses: PortalCourse[];
  staff: StaffMember[];
}

// Every Institution OS section, which staff roles see it, and the licensed module it needs (if any).
const TABS: readonly (readonly [string, string, readonly StaffRole[], string?])[] = [
  ["brain", "BI brain", ["ADMIN", "LECTURER", "COUNSELLOR"]],
  ["analytics", "Analytics", ["ADMIN", "COUNSELLOR"], "analytics"],
  ["market", "Market", ["ADMIN", "COUNSELLOR"], "market"],
  ["crm", "CRM", ["ADMIN", "COUNSELLOR"], "crm"],
  ["admissions", "Admissions", ["ADMIN", "COUNSELLOR"], "admissions"],
  ["ai", "AI assistant", ["ADMIN", "COUNSELLOR"], "ai"],
  ["fees", "Fees", ["ADMIN"], "fees"],
  ["students", "Students", ["ADMIN"]],
  ["notices", "Notices", ["ADMIN", "LECTURER"]],
  ["events", "Events", ["ADMIN", "LECTURER"]],
  ["clubs", "Clubs", ["ADMIN", "LECTURER"]],
  ["courses", "Courses", ["ADMIN", "LECTURER"]],
  ["staff", "Staff", ["ADMIN"]],
  ["services", "Services", ["ADMIN"]],
  ["settings", "Settings", ["ADMIN"]],
];
type Tab = string;
const ROLE_NAME: Record<StaffRole, string> = { ADMIN: "Institution admin", LECTURER: "Lecturer", COUNSELLOR: "Counsellor" };

/** Submits a form as JSON, then toasts and reloads. Returns false (and toasts) on failure. */
export async function submit(path: string, json: unknown, ok: string, after: () => void, method = "POST") {
  try {
    await api(path, { method, json });
    toast(ok);
    after();
    return true;
  } catch (e) {
    const f = e as ApiFailure;
    const first = f.issues && Object.values(f.issues).flat()[0];
    toast(first ? `${f.message}: ${first}` : f.message);
    return false;
  }
}

export async function remove(path: string, what: string, after: () => void) {
  if (!window.confirm(`Delete ${what}? This can’t be undone.`)) return;
  try {
    await api(path, { method: "DELETE" });
    toast("Deleted");
    after();
  } catch (e) {
    toast((e as Error).message);
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function InstitutionView() {
  const [data, setData] = useState<Portal | null>(null);
  const [blocked, setBlocked] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("brain");
  const [filter, setFilter] = useState<Record<string, string> | undefined>(undefined);
  const go = (t: string, f?: Record<string, string>) => { setFilter(f); setTab(t as Tab); };

  const load = useCallback(() => {
    api<Portal>("/institution")
      .then(setData)
      .catch((e) => { if (e instanceof ApiFailure) setBlocked(e.status); else toast((e as Error).message); });
  }, []);
  useEffect(load, [load]);

  if (blocked) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="path-ic" style={{ background: "var(--sun)" }}><Icon name="i-brain" /></span>
        <h2 className="h-card">{blocked === 401 ? "Institution portal" : "Staff only"}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {blocked === 401
            ? "Verify your students and run Campus Life: notices, events, clubs, courses and grades. Sign in with your institution staff account."
            : "This portal is for institution staff. If you should have access, ask your institution admin to add you."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {blocked === 401 && <Link className="btn btn-primary" href="/login">Sign in</Link>}
          <a className="btn btn-ghost" href="/for-institutions">What Institution OS includes</a>
        </div>
      </div>
    );
  }
  if (!data) return <p className="muted">Loading the portal…</p>;

  const isAdmin = data.me.staffRole === "ADMIN";
  const tabs = TABS.filter(([, , roles, mod]) => roles.includes(data.me.staffRole) && (!mod || data.modules.includes(mod))).map(([v, l]) => [v, l] as const);
  const brand = data.branding;

  return (
    <div style={brand.brandColor ? ({ ["--brand" as string]: brand.brandColor }) : undefined}>
      <div className="sec-head">
        <div className="l" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {brand.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={brand.logoUrl} alt="" className="inst-logo" />
            : <span className="inst-logo brand-initials">{data.institution.shortName.slice(0, 3)}</span>}
          <div>
            <span className="eyebrow">Institution OS{brand.tagline ? ` · ${brand.tagline}` : ""}</span>
            <h1 className="h-sec page-title" style={{ margin: 0 }}>{data.institution.name}.</h1>
          </div>
        </div>
        <p className="r">Signed in as {data.me.name} · {ROLE_NAME[data.me.staffRole]}</p>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(t) => go(t)} label="Institution OS sections" />

      {tab === "brain" && <BrainPanel go={go} />}
      {tab === "analytics" && <AnalyticsPanel />}
      {tab === "market" && <MarketPanel />}
      {tab === "crm" && <CrmPanel key={JSON.stringify(filter ?? {})} staff={data.staff} meId={data.me.id} isAdmin={isAdmin} initial={filter} />}
      {tab === "admissions" && <AdmissionsPanel key={JSON.stringify(filter ?? {})} initial={filter} />}
      {tab === "settings" && isAdmin && <SettingsPanel onBrandingChange={load} extra={<PaymentsSettings />} />}
      {tab === "fees" && isAdmin && <FeesPanel />}
      {tab === "ai" && <AiPanel isAdmin={isAdmin} slug={data.institution.slug} />}
      {tab === "services" && isAdmin && <ServicesPanel />}

      {tab === "students" && isAdmin && <VerificationQueue endpoint="/institution/verifications" embedded />}

      {tab === "notices" && (
        <div className="panel-grid">
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            if (await submit("/institution/announcements", { title: str(f, "title"), body: str(f, "body"), pinned: f.get("pinned") === "on" }, "Notice posted", load)) form.reset();
          }}>
            <h3 className="h-card">Post a notice</h3>
            <div className="field"><label htmlFor="n-title">Title</label><input className="input" id="n-title" name="title" required minLength={2} maxLength={120} /></div>
            <div className="field"><label htmlFor="n-body">Message</label><textarea className="input" id="n-body" name="body" required maxLength={4000} /></div>
            <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="pinned" /> Pin to the top of Campus Life</label>
            <button className="btn btn-primary">Post to students</button>
          </form>
          <div className="card panel">
            <h3 className="h-card">{data.announcements.length} notices</h3>
            {data.announcements.map((a) => (
              <div key={a.id} className="list-row">
                <div><b>{a.title}</b>{a.pinned && <> · <span className="tiny">Pinned</span></>}<div className="meta" style={{ whiteSpace: "pre-line" }}>{a.body}</div><div className="meta">{a.author.name} · {fmtDate(a.createdAt)}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/announcements/${a.id}`, `“${a.title}”`, load)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="panel-grid">
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            const cap = str(f, "capacity");
            const ok = await submit("/institution/events", {
              title: str(f, "title"), location: str(f, "location"), description: str(f, "description"),
              startsAt: colomboIso(str(f, "startsAt")), endsAt: str(f, "endsAt") ? colomboIso(str(f, "endsAt")) : null,
              capacity: cap ? Number(cap) : null,
            }, "Event created", load);
            if (ok) form.reset();
          }}>
            <h3 className="h-card">Create an event</h3>
            <div className="form-grid">
              <div className="field full"><label htmlFor="e-title">Title</label><input className="input" id="e-title" name="title" required minLength={2} maxLength={120} /></div>
              <div className="field full"><label htmlFor="e-loc">Location</label><input className="input" id="e-loc" name="location" required maxLength={160} /></div>
              <div className="field"><label htmlFor="e-start">Starts (Sri Lanka time)</label><input className="input" id="e-start" name="startsAt" type="datetime-local" required /></div>
              <div className="field"><label htmlFor="e-end">Ends (optional)</label><input className="input" id="e-end" name="endsAt" type="datetime-local" /></div>
              <div className="field"><label htmlFor="e-cap">Capacity (blank = no limit)</label><input className="input" id="e-cap" name="capacity" type="number" min={1} /></div>
              <div className="field full"><label htmlFor="e-desc">Description</label><textarea className="input" id="e-desc" name="description" maxLength={4000} /></div>
            </div>
            <button className="btn btn-primary">Create event</button>
          </form>
          <div className="card panel">
            <h3 className="h-card">{data.events.length} events</h3>
            {data.events.map((e) => (
              <div key={e.id} className="list-row">
                <div><b>{e.title}</b><div className="meta">{fmtDateTime(e.startsAt)} · {e.location}</div><div className="meta">{e.going}{e.capacity ? `/${e.capacity}` : ""} going</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/events/${e.id}`, `“${e.title}”`, load)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "clubs" && (
        <div className="panel-grid">
          <form className="card panel" onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            if (await submit("/institution/clubs", { name: str(f, "name"), description: str(f, "description") }, "Club created", load)) form.reset();
          }}>
            <h3 className="h-card">Start a club</h3>
            <div className="field"><label htmlFor="c-name">Name</label><input className="input" id="c-name" name="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label htmlFor="c-desc">Description</label><textarea className="input" id="c-desc" name="description" maxLength={2000} /></div>
            <button className="btn btn-primary">Create club</button>
          </form>
          <div className="card panel">
            <h3 className="h-card">{data.clubs.length} clubs</h3>
            {data.clubs.map((c) => (
              <div key={c.id} className="list-row">
                <div><b>{c.name}</b><div className="meta">{c.members} {c.members === 1 ? "member" : "members"}{c.description ? ` · ${c.description}` : ""}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/clubs/${c.id}`, `“${c.name}” and its member list`, load)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "courses" && <CoursesPanel courses={data.courses} staff={data.staff} reload={load} lms={data.modules.includes("lms")} />}
      {tab === "staff" && isAdmin && <StaffPanel staff={data.staff} meId={data.me.id} reload={load} />}
    </div>
  );
}
