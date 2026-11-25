"use client";
import { useCallback, useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { remove, submit } from "./InstitutionView";

interface Lesson { id: string; title: string; body: string; url: string | null; published: boolean; completed: number }
interface Mod { id: string; title: string; lessons: Lesson[] }

export function ContentEditor({ courseId, enrolled }: { courseId: string; enrolled: number }) {
  const [mods, setMods] = useState<Mod[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ modules: Mod[] }>(`/institution/courses/${courseId}/content`).then((r) => setMods(r.modules)).catch((e) => toast(e.message));
  }, [courseId]);
  useEffect(load, [load]);
  if (!mods) return <p className="muted">Loading content…</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {mods.map((m) => (
        <div key={m.id} className="card panel">
          <div className="row">
            <h3 className="h-card">{m.title}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/modules/${m.id}`, `“${m.title}” and its lessons`, load)}>Delete</button>
          </div>
          {m.lessons.map((l) => (
            <div key={l.id} className="list-row">
              <div>
                <b>{l.title}</b>{!l.published && <span className="tiny"> · draft</span>}
                {l.body && <div className="meta" style={{ whiteSpace: "pre-line" }}>{l.body}</div>}
                {l.url && <div className="meta"><a href={l.url} target="_blank" rel="noreferrer">{l.url}</a></div>}
                <div className="meta">{l.completed}/{enrolled} completed</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => submit(`/institution/lessons/${l.id}`, { published: !l.published }, l.published ? "Hidden from students" : "Published", load, "PATCH")}>{l.published ? "Unpublish" : "Publish"}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/lessons/${l.id}`, `“${l.title}”`, load)}>Delete</button>
              </div>
            </div>
          ))}
          {adding === m.id ? (
            <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={async (e) => {
              e.preventDefault(); const f = new FormData(e.currentTarget);
              const ok = await submit(`/institution/modules/${m.id}/lessons`, {
                title: String(f.get("title")).trim(), body: String(f.get("body") ?? "").trim(), url: String(f.get("url") ?? "").trim(), published: f.get("published") === "on",
              }, "Lesson added", load);
              if (ok) setAdding(null);
            }}>
              <div className="field"><label htmlFor={`lt-${m.id}`}>Lesson title</label><input className="input" id={`lt-${m.id}`} name="title" required minLength={2} /></div>
              <div className="field"><label htmlFor={`lb-${m.id}`}>Notes for students</label><textarea className="input" id={`lb-${m.id}`} name="body" /></div>
              <div className="field"><label htmlFor={`lu-${m.id}`}>Link (video, slides, reading)</label><input className="input" id={`lu-${m.id}`} name="url" type="url" placeholder="https://" /></div>
              <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="published" defaultChecked /> Publish now</label>
              <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary btn-sm">Add lesson</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(null)}>Cancel</button></div>
            </form>
          ) : <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(m.id)}>+ Lesson</button>}
        </div>
      ))}
      <form className="card panel" style={{ flexDirection: "row", alignItems: "flex-end" }} onSubmit={async (e) => {
        e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
        if (await submit(`/institution/courses/${courseId}/content`, { title: String(f.get("title")).trim() }, "Module added", load)) form.reset();
      }}>
        <div className="field" style={{ flex: 1 }}><label htmlFor="nm">New module (week or unit)</label><input className="input" id="nm" name="title" required minLength={2} placeholder={`Week ${mods.length + 1} · …`} /></div>
        <button className="btn btn-primary btn-sm">Add module</button>
      </form>
    </div>
  );
}

type Status = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
interface AttData {
  atRiskBelow: number; lessons: number;
  sessions: { id: string; date: string; title: string; records: { studentId: string; status: Status }[] }[];
  learners: { id: string; studentNumber: string; name: string; attendance: number | null; progress: number | null; atRisk: boolean }[];
}
const STATUSES: [Status, string][] = [["PRESENT", "Present"], ["LATE", "Late"], ["ABSENT", "Absent"], ["EXCUSED", "Excused"]];

export function AttendancePanel({ courseId }: { courseId: string }) {
  const [d, setD] = useState<AttData | null>(null);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [date, setDate] = useState("");
  const load = useCallback(() => {
    api<AttData>(`/institution/courses/${courseId}/attendance`).then((r) => { setD(r); setMarks(Object.fromEntries(r.learners.map((l) => [l.id, "PRESENT" as Status]))); }).catch((e) => toast(e.message));
  }, [courseId]);
  useEffect(load, [load]);
  if (!d) return <p className="muted">Loading attendance…</p>;
  return (
    <div className="panel-grid">
      <div className="card panel">
        <h3 className="h-card">Learners</h3>
        <table className="gradebook">
          <thead><tr><th>Learner</th><th>Attendance</th><th>Progress</th><th /></tr></thead>
          <tbody>{d.learners.map((l) => (
            <tr key={l.id}><td>{l.name}<div className="tiny">{l.studentNumber}</div></td><td>{l.attendance === null ? "—" : `${l.attendance}%`}</td><td>{l.progress === null ? "—" : `${l.progress}%`}</td>
              <td>{l.atRisk ? <span className="tag" style={{ background: "var(--coral)" }}>At risk</span> : <span className="tag soft">On track</span>}</td></tr>
          ))}</tbody>
        </table>
        <div className="tiny">At risk = attendance below {d.atRiskBelow}%. Progress = published lessons completed ({d.lessons}).</div>
      </div>
      <div className="card panel">
        <h3 className="h-card">Take attendance</h3>
        {d.learners.length ? (
          <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={async (e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            const ok = await submit(`/institution/courses/${courseId}/attendance`, {
              date: date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }), title: String(f.get("title") ?? "").trim() || "Class",
              records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })),
            }, "Attendance saved", load);
            if (ok) setDate("");
          }}>
            <div className="form-grid">
              <div className="field"><label htmlFor="at-d">Date</label><input className="input" id="at-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="field"><label htmlFor="at-t">Session</label><input className="input" id="at-t" name="title" placeholder="Lecture" /></div>
            </div>
            {d.learners.map((l) => (
              <div key={l.id} className="list-row" style={{ alignItems: "center" }}>
                <span>{l.name}</span>
                <select className="select" value={marks[l.id]} onChange={(e) => setMarks((m) => ({ ...m, [l.id]: e.target.value as Status }))} aria-label={`Attendance for ${l.name}`} style={{ maxWidth: 140 }}>
                  {STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
            ))}
            <button className="btn btn-primary btn-sm">Save attendance</button>
          </form>
        ) : <p className="muted small" style={{ margin: 0 }}>Enrol students first.</p>}
        {d.sessions.length > 0 && <b className="small" style={{ marginTop: 6 }}>Past sessions</b>}
        {d.sessions.map((s) => {
          const present = s.records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
          return (
            <div key={s.id} className="list-row">
              <div><b>{s.title}</b><div className="meta">{fmtDate(s.date)} · {present}/{s.records.length} attended</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/attendance/${s.id}`, `the ${s.title} session record`, load)}>Delete</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
