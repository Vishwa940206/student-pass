"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { api, ApiFailure, toast } from "@/lib/client";
import { fmtDate, fmtDateTime, relDays } from "@/lib/format";
import { Chat } from "@/components/Chat";
import { CourseView, FeesView } from "./CampusExtras";

interface Grade { marks: number; feedback: string | null; gradedAt: string }
interface Assignment { id: string; title: string; description: string; dueAt: string; maxMarks: number; grade: Grade | null }
interface Course { id: string; code: string; name: string; lecturer: { name: string } | null; assignments: Assignment[] }
interface CampusEvent { id: string; title: string; description: string; location: string; startsAt: string; endsAt: string | null; capacity: number | null; going: number; mine: boolean }
interface Club { id: string; name: string; description: string; members: number; mine: boolean }
interface Notice { id: string; title: string; body: string; pinned: boolean; createdAt: string; author: { name: string } }
interface Campus { loadedAt: number; institution: { name: string; shortName: string }; branding: { tagline: string | null; brandColor: string | null; logoUrl: string | null }; announcements: Notice[]; events: CampusEvent[]; clubs: Club[]; courses: Course[] }

const TABS = [["today", "Today"], ["courses", "Courses"], ["events", "Events"], ["clubs", "Clubs"], ["notices", "Notices"], ["fees", "Fees"], ["ask", "Ask"]] as const;
type Tab = (typeof TABS)[number][0];

export function CampusView() {
  const [data, setData] = useState<Campus | null>(null);
  const [blocked, setBlocked] = useState<{ status: number; code: string; message: string } | null>(null);
  // ?tab=fees (e.g. returning from payment). Safe to read here: the first render shows
  // "Loading…" on server and client alike, so the tab never affects hydration.
  const [tab, setTab] = useState<Tab>(() => {
    const t = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
    return TABS.some(([v]) => v === t) ? (t as Tab) : "today";
  });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Omit<Campus, "loadedAt">>("/campus")
      .then((r) => setData({ ...r, loadedAt: Date.now() }))
      .catch((e) => { if (e instanceof ApiFailure) setBlocked({ status: e.status, code: e.code, message: e.message }); else toast((e as Error).message); });
  }, []);
  useEffect(load, [load]);

  async function toggle(kind: "event" | "club", id: string, on: boolean) {
    setBusy(id);
    try {
      const path = kind === "event" ? `/campus/events/${id}/rsvp` : `/campus/clubs/${id}/membership`;
      await api(path, { method: on ? "POST" : "DELETE" });
      setData((d) => d && (kind === "event"
        ? { ...d, events: d.events.map((e) => (e.id === id ? { ...e, mine: on, going: e.going + (on ? 1 : -1) } : e)) }
        : { ...d, clubs: d.clubs.map((c) => (c.id === id ? { ...c, mine: on, members: c.members + (on ? 1 : -1) } : c)) }));
      toast(kind === "event" ? (on ? "You’re going" : "RSVP cancelled") : (on ? "Joined" : "Left the club"));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (blocked) return <Blocked {...blocked} />;
  if (!data) return <p className="muted">Loading your campus…</p>;

  const now = data.loadedAt;
  const dueSoon = data.courses
    .flatMap((c) => c.assignments.map((a) => ({ ...a, course: c })))
    .filter((a) => !a.grade && new Date(a.dueAt).getTime() > now - 86_400_000)
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));

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
            <span className="eyebrow">Campus Life{brand.tagline ? ` · ${brand.tagline}` : ""}</span>
            <h1 className="h-sec page-title" style={{ margin: 0 }}>{data.institution.name}.</h1>
          </div>
        </div>
        <p className="r">Your courses, deadlines, events and clubs, from {data.institution.shortName}.</p>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Campus Life sections" />

      {tab === "today" && (
        <div className="panel-grid">
          <div className="card panel">
            <h3 className="h-card">Due soon</h3>
            {dueSoon.length ? dueSoon.slice(0, 6).map((a) => (
              <div key={a.id} className="list-row">
                <div><b>{a.title}</b><div className="meta">{a.course.code} · {a.course.name}</div></div>
                <span className="tag" style={{ background: new Date(a.dueAt).getTime() - now < 3 * 86_400_000 ? "var(--sun)" : "var(--surface-2)" }}>{relDays(a.dueAt)}</span>
              </div>
            )) : <p className="muted small" style={{ margin: 0 }}>Nothing due. Enjoy it.</p>}
          </div>
          <div className="card panel">
            <h3 className="h-card">Coming up</h3>
            {data.events.length ? data.events.slice(0, 4).map((e) => (
              <div key={e.id} className="list-row">
                <div><b>{e.title}</b><div className="meta">{fmtDateTime(e.startsAt)} · {e.location}</div></div>
                {e.mine && <span className="tag" style={{ background: "var(--mint)" }}>Going</span>}
              </div>
            )) : <p className="muted small" style={{ margin: 0 }}>No events yet.</p>}
          </div>
          {data.announcements.filter((a) => a.pinned).map((a) => <NoticeCard key={a.id} n={a} />)}
        </div>
      )}

      {tab === "courses" && courseId && <CourseView id={courseId} back={() => setCourseId(null)} />}
      {tab === "courses" && !courseId && (
        data.courses.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.courses.map((c) => <CourseCard key={c.id} c={c} open={() => setCourseId(c.id)} />)}
          </div>
        ) : <div className="empty">You’re not enrolled in any courses yet. Your lecturers add you using your student number.</div>
      )}

      {tab === "events" && (
        data.events.length ? (
          <div className="panel-grid">
            {data.events.map((e) => {
              const full = e.capacity !== null && e.going >= e.capacity && !e.mine;
              return (
                <div key={e.id} className="card panel">
                  <div className="row">
                    <span className="tag soft">{fmtDate(e.startsAt)}</span>
                    {e.capacity !== null && <span className="tiny">{e.going}/{e.capacity} going</span>}
                  </div>
                  <h3 className="h-card">{e.title}</h3>
                  <p className="muted small" style={{ margin: 0 }}>{e.description}</p>
                  <div className="tiny">{fmtDateTime(e.startsAt)}{e.endsAt ? ` – ${fmtDateTime(e.endsAt)}` : ""} · {e.location}</div>
                  <button className={`btn btn-sm ${e.mine ? "btn-ghost" : "btn-mint"}`} disabled={busy === e.id || full} onClick={() => toggle("event", e.id, !e.mine)}>
                    {e.mine ? "Cancel RSVP" : full ? "Full" : "I’m going"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : <div className="empty">No upcoming events.</div>
      )}

      {tab === "clubs" && (
        data.clubs.length ? (
          <div className="panel-grid">
            {data.clubs.map((c) => (
              <div key={c.id} className="card panel">
                <div className="row"><h3 className="h-card">{c.name}</h3><span className="tiny">{c.members} {c.members === 1 ? "member" : "members"}</span></div>
                <p className="muted small" style={{ margin: 0 }}>{c.description}</p>
                <button className={`btn btn-sm ${c.mine ? "btn-ghost" : "btn-mint"}`} disabled={busy === c.id} onClick={() => toggle("club", c.id, !c.mine)}>
                  {c.mine ? "Leave" : "Join"}
                </button>
              </div>
            ))}
          </div>
        ) : <div className="empty">No clubs yet.</div>
      )}

      {tab === "fees" && <FeesView />}
      {tab === "ask" && (
        <Chat endpoint="/campus/chat" title={`Ask ${data.institution.shortName}`}
          greeting={`Hi there! I can help with intakes, fees, policies and your own deadlines and invoices.`}
          suggestions={["What’s due this week?", "Do I owe anything?", "How do scholarships work?"]} />
      )}
      {tab === "notices" && (
        data.announcements.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.announcements.map((a) => <NoticeCard key={a.id} n={a} />)}
          </div>
        ) : <div className="empty">No announcements yet.</div>
      )}
    </div>
  );
}

function NoticeCard({ n }: { n: Notice }) {
  return (
    <div className="card panel">
      <div className="row">
        <h3 className="h-card">{n.title}</h3>
        {n.pinned && <span className="tag" style={{ background: "var(--sun)" }}>Pinned</span>}
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-line" }}>{n.body}</p>
      <div className="tiny">{n.author.name} · {fmtDate(n.createdAt)}</div>
    </div>
  );
}

function CourseCard({ c, open }: { c: Course; open: () => void }) {
  const graded = c.assignments.filter((a) => a.grade);
  const pct = graded.length ? Math.round((100 * graded.reduce((s, a) => s + a.grade!.marks / a.maxMarks, 0)) / graded.length) : null;
  return (
    <div className="card panel">
      <div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="tag soft">{c.code}</span>
          {pct !== null && <span className="tag" style={{ background: "var(--mint)" }}>Average {pct}%</span>}
        </div>
        <h3 className="h-card" style={{ marginTop: 10 }}>{c.name}</h3>
        {c.lecturer && <div className="tiny">{c.lecturer.name}</div>}
        <button className="btn btn-mint btn-sm" style={{ marginTop: 10 }} onClick={open}>Open course</button>
      </div>
      {c.assignments.length ? c.assignments.map((a) => (
        <div key={a.id} className="list-row">
          <div>
            <b>{a.title}</b>
            <div className="meta">Due {fmtDateTime(a.dueAt)}{a.description ? ` · ${a.description}` : ""}</div>
            {a.grade?.feedback && <div className="meta">“{a.grade.feedback}”</div>}
          </div>
          {a.grade
            ? <span className="tag" style={{ background: "var(--mint)" }}>{a.grade.marks}/{a.maxMarks}</span>
            : <span className="tag soft">{new Date(a.dueAt) < new Date() ? "Awaiting grade" : relDays(a.dueAt)}</span>}
        </div>
      )) : <p className="muted small" style={{ margin: 0 }}>No assignments yet.</p>}
    </div>
  );
}

function Blocked({ status, code, message }: { status: number; code: string; message: string }) {
  const staff = code === "FORBIDDEN"; // signed in, but not a student (staff, merchant, admin)
  return (
    <div className="card" style={{ padding: 32, maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>
      <span className="path-ic" style={{ background: "var(--lilac)" }}><Icon name="i-book" /></span>
      <h2 className="h-card">
        {status === 401 ? "Sign in to Campus Life" : staff ? "Campus Life is for students" : code === "NOT_VERIFIED" ? "Almost there" : "Campus Life isn’t available"}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {status === 401
          ? "Your courses, deadlines, events and clubs, from your institution. Sign in with your Student Pass account."
          : staff ? "Institution staff manage Campus Life from the institution portal." : message}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {status === 401 && <Link className="btn btn-primary" href="/login">Sign in</Link>}
        {staff && <Link className="btn btn-primary" href="/institution">Institution portal</Link>}
        {code === "NOT_VERIFIED" && <Link className="btn btn-primary" href="/pass">Check my pass</Link>}
        {status === 401 && <a className="btn btn-ghost" href="/signup">Get Student Pass</a>}
      </div>
    </div>
  );
}
