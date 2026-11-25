"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, formatLkr, toast } from "@/lib/client";
import { fmtDate, fmtDateTime, relDays } from "@/lib/format";

interface CourseData {
  course: { id: string; code: string; name: string; lecturer: { name: string } | null };
  modules: { id: string; title: string; lessons: { id: string; title: string; body: string; url: string | null; done: boolean }[] }[];
  assignments: { id: string; title: string; description: string; dueAt: string; maxMarks: number; grade: { marks: number; feedback: string | null } | null; submission: { text: string; link: string | null; submittedAt: string } | null }[];
  attendance: { pct: number | null; recent: { date: string; title: string; status: string }[] } | null;
}

export function CourseView({ id, back }: { id: string; back: () => void }) {
  const [d, setD] = useState<CourseData | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(() => { api<CourseData>(`/campus/courses/${id}`).then(setD).catch((e) => toast(e.message)); }, [id]);
  useEffect(load, [load]);
  if (!d) return <p className="muted">Loading course…</p>;
  const lessons = d.modules.flatMap((m) => m.lessons);
  const done = lessons.filter((l) => l.done).length;

  async function toggle(lessonId: string, on: boolean) {
    try { await api(`/campus/lessons/${lessonId}/complete`, { method: on ? "POST" : "DELETE" }); load(); } catch (e) { toast((e as Error).message); }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={back}>← My courses</button>
        <h2 className="h-card" style={{ margin: 0 }}>{d.course.code} · {d.course.name}</h2>
        {d.course.lecturer && <span className="tiny">{d.course.lecturer.name}</span>}
      </div>
      <div className="kpis">
        {lessons.length > 0 && <div className="stat"><span className="tiny">Lessons done</span><b>{done}/{lessons.length}</b></div>}
        {d.attendance && <div className="stat" style={d.attendance.pct !== null && d.attendance.pct < 75 ? { background: "color-mix(in oklab, var(--coral) 25%, var(--surface))" } : undefined}><span className="tiny">Attendance</span><b>{d.attendance.pct === null ? "—" : `${d.attendance.pct}%`}</b></div>}
        <div className="stat"><span className="tiny">Assignments</span><b>{d.assignments.filter((a) => a.submission || a.grade).length}/{d.assignments.length}</b></div>
      </div>
      <div className="panel-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {d.modules.map((m) => (
            <div key={m.id} className="card panel">
              <h3 className="h-card">{m.title}</h3>
              {m.lessons.map((l) => (
                <div key={l.id} className="list-row">
                  <div>
                    <b>{l.title}</b>
                    {l.body && <div className="meta" style={{ whiteSpace: "pre-line" }}>{l.body}</div>}
                    {l.url && <div className="meta"><a href={l.url} target="_blank" rel="noreferrer">Open material ↗</a></div>}
                  </div>
                  <button className={`btn btn-sm ${l.done ? "btn-mint" : "btn-ghost"}`} onClick={() => toggle(l.id, !l.done)} aria-pressed={l.done}>{l.done ? "✓ Done" : "Mark done"}</button>
                </div>
              ))}
              {!m.lessons.length && <p className="muted small" style={{ margin: 0 }}>Lessons coming soon.</p>}
            </div>
          ))}
          {!d.modules.length && <div className="empty">Your lecturer hasn’t added course content yet.</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card panel">
            <h3 className="h-card">Assignments</h3>
            {d.assignments.map((a) => (
              <div key={a.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="row">
                  <div><b>{a.title}</b><div className="meta">Due {fmtDateTime(a.dueAt)} · out of {a.maxMarks}</div>{a.description && <div className="meta">{a.description}</div>}</div>
                  {a.grade ? <span className="tag" style={{ background: "var(--mint)" }}>{a.grade.marks}/{a.maxMarks}</span>
                    : a.submission ? <span className="tag soft">Submitted</span>
                    : <span className="tag" style={{ background: new Date(a.dueAt) < new Date() ? "var(--coral)" : "var(--surface-2)" }}>{relDays(a.dueAt)}</span>}
                </div>
                {a.grade?.feedback && <div className="meta">“{a.grade.feedback}”</div>}
                {a.submission && <div className="meta">Your work, {fmtDate(a.submission.submittedAt)}{new Date(a.submission.submittedAt) > new Date(a.dueAt) ? " (late)" : ""}: {a.submission.text.slice(0, 160)}{a.submission.link && <> · <a href={a.submission.link} target="_blank" rel="noreferrer">link</a></>}</div>}
                {!a.grade && (editing === a.id ? (
                  <form style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }} onSubmit={async (e) => {
                    e.preventDefault(); const f = new FormData(e.currentTarget);
                    try {
                      const r = await api<{ late: boolean }>(`/campus/assignments/${a.id}/submission`, { method: "PUT", json: { text: String(f.get("text") ?? "").trim(), link: String(f.get("link") ?? "").trim() } });
                      toast(r.late ? "Submitted (after the deadline)" : "Submitted"); setEditing(null); load();
                    } catch (err) { const fe = err as ApiFailure; toast(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
                  }}>
                    <textarea className="input" name="text" defaultValue={a.submission?.text ?? ""} placeholder="Your answer or a note to your lecturer" aria-label="Your work" />
                    <input className="input" name="link" type="url" defaultValue={a.submission?.link ?? ""} placeholder="Link to your work (Drive, GitHub…)" aria-label="Link" />
                    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary btn-sm">Submit</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div>
                  </form>
                ) : <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => setEditing(a.id)}>{a.submission ? "Edit submission" : "Submit work"}</button>)}
              </div>
            ))}
            {!d.assignments.length && <p className="muted small" style={{ margin: 0 }}>No assignments yet.</p>}
          </div>
          {d.attendance && d.attendance.recent.length > 0 && (
            <div className="card panel">
              <h3 className="h-card">Recent attendance</h3>
              {d.attendance.recent.map((r, i) => (
                <div key={i} className="list-row"><span>{r.title} · {fmtDate(r.date)}</span><span className="tag" style={{ background: r.status === "ABSENT" ? "var(--coral)" : r.status === "LATE" ? "var(--sun)" : "var(--surface-2)" }}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface FeesData {
  enabled: boolean; payOnline: boolean;
  invoices: { id: string; number: string; item: string; amountCents: number; dueDate: string; status: string; display: string; paidAt: string | null; shared: boolean; payments: { method: string; reference: string | null; createdAt: string }[] }[];
}

export function FeesView() {
  const [d, setD] = useState<FeesData | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const load = useCallback(() => { api<FeesData>("/campus/fees").then(setD).catch((e) => toast(e.message)); }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (paid) toast(`Thanks. We’re confirming payment for ${paid} with the bank. It updates here within a minute.`);
  }, []);

  async function pay(id: string, phone: string) {
    try {
      const r = await api<{ action: string; fields: Record<string, string> }>(`/campus/invoices/${id}/checkout`, { method: "POST", json: { phone } });
      // Hand over to PayHere's hosted checkout (card details never touch Student Pass).
      const form = document.createElement("form");
      form.method = "POST"; form.action = r.action;
      for (const [k, v] of Object.entries(r.fields)) { const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; form.appendChild(i); }
      document.body.appendChild(form); form.submit();
    } catch (e) { const fe = e as ApiFailure; toast(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
  }

  if (!d) return <p className="muted">Loading fees…</p>;
  if (!d.enabled) return <div className="empty">Fees aren’t managed in Student Pass for your institution.</div>;
  const owed = d.invoices.filter((i) => i.status === "DUE").reduce((n, i) => n + i.amountCents, 0);
  return (
    <>
      <div className="kpis">
        <div className="stat"><span className="tiny">To pay</span><b style={{ fontSize: 24 }}>{formatLkr(owed)}</b></div>
        <div className="stat"><span className="tiny">Overdue</span><b>{d.invoices.filter((i) => i.display === "OVERDUE").length}</b></div>
      </div>
      <div className="card panel">
        <div className="row"><h3 className="h-card">Invoices</h3><button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button></div>
        {d.invoices.map((i) => (
          <div key={i.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className="row">
              <div><b>{i.item}</b><div className="meta">{i.number} · due {fmtDate(i.dueDate)}{i.paidAt ? ` · paid ${fmtDate(i.paidAt)}` : ""}</div></div>
              <div style={{ textAlign: "right" }}><b>{formatLkr(i.amountCents)}</b><div><span className="tag" style={{ background: i.display === "PAID" ? "var(--mint)" : i.display === "OVERDUE" ? "var(--coral)" : "var(--surface-2)" }}>{i.display === "DUE" ? "To pay" : i.display.charAt(0) + i.display.slice(1).toLowerCase()}</span></div></div>
            </div>
            {i.status === "DUE" && <FamilyLink invoiceId={i.id} shared={i.shared} onChange={load} />}
            {i.status === "DUE" && d.payOnline && (paying === i.id ? (
              <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); pay(i.id, String(new FormData(e.currentTarget).get("phone") ?? "")); }}>
                <input className="input" name="phone" type="tel" required placeholder="Mobile for the receipt" aria-label="Mobile" style={{ flex: "1 1 180px" }} />
                <button className="btn btn-mint btn-sm">Continue to secure payment</button>
              </form>
            ) : <button className="btn btn-mint btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => setPaying(i.id)}>Pay {formatLkr(i.amountCents)} online</button>)}
          </div>
        ))}
        {!d.invoices.length && <p className="muted small" style={{ margin: 0 }}>No invoices. You’re all clear.</p>}
        {!d.payOnline && d.invoices.some((i) => i.status === "DUE") && <p className="tiny" style={{ margin: 0 }}>Pay at your institution’s finance office. Online payment isn’t set up yet.</p>}
      </div>
    </>
  );
}

/** "Amma pays the link": share an unpaid invoice with family. */
function FamilyLink({ invoiceId, shared, onChange }: { invoiceId: string; shared: boolean; onChange: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  async function share() {
    try {
      const r = await api<{ url: string }>(`/campus/invoices/${invoiceId}/share`, { method: "POST" });
      setUrl(r.url);
      if (navigator.share) await navigator.share({ title: "Student fee", text: "Could you pay my fee with this link?", url: r.url }).catch(() => {});
      else await navigator.clipboard?.writeText(r.url).then(() => toast("Link copied. Send it on WhatsApp or SMS"));
      if (!shared) onChange();
    } catch (e) { toast((e as Error).message); }
  }
  async function stop() {
    try { await api(`/campus/invoices/${invoiceId}/share`, { method: "DELETE" }); setUrl(null); toast("Link turned off"); onChange(); } catch (e) { toast((e as Error).message); }
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
      <button className="btn btn-ghost btn-sm" onClick={share}>{shared ? "Share link again" : "Ask family to pay"}</button>
      {shared && <button className="btn btn-ghost btn-sm" onClick={stop}>Stop sharing</button>}
      {url && <span className="tiny" style={{ wordBreak: "break-all" }}>{url}</span>}
    </div>
  );
}
