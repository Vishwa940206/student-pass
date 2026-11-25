"use client";
import { useCallback, useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { colomboIso, fmtDateTime } from "@/lib/format";
import { Tabs } from "@/components/Tabs";
import { remove, submit, type PortalCourse, type StaffMember } from "./InstitutionView";
import { AttendancePanel, ContentEditor } from "./LmsPanels";

interface Enrolled { id: string; studentNumber: string; name: string; email: string; verificationStatus: string }
interface GradeRow { id: string; studentNumber: string; name: string; grade: { marks: number; feedback: string | null } | null; submission: { text: string; link: string | null; submittedAt: string } | null }

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function CoursesPanel({ courses, staff, reload, lms = false }: { courses: PortalCourse[]; staff: StaffMember[]; reload: () => void; lms?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = courses.find((c) => c.id === openId) ?? null;

  if (open) return <CourseDetail course={open} back={() => setOpenId(null)} reload={reload} lms={lms} />;

  return (
    <div className="panel-grid">
      <form className="card panel" onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        const ok = await submit("/institution/courses", { code: str(f, "code"), name: str(f, "name"), lecturerId: str(f, "lecturerId") || null }, "Course created", reload);
        if (ok) form.reset();
      }}>
        <h3 className="h-card">Add a course</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="co-code">Code</label><input className="input" id="co-code" name="code" placeholder="CS101" required minLength={2} maxLength={20} /></div>
          <div className="field"><label htmlFor="co-lec">Lecturer</label>
            <select className="select" id="co-lec" name="lecturerId" defaultValue="">
              <option value="">Not assigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field full"><label htmlFor="co-name">Name</label><input className="input" id="co-name" name="name" placeholder="Programming Foundations" required minLength={2} maxLength={120} /></div>
        </div>
        <button className="btn btn-primary">Add course</button>
      </form>
      <div className="card panel">
        <h3 className="h-card">{courses.length} courses</h3>
        {courses.map((c) => (
          <div key={c.id} className="list-row">
            <div><b>{c.code} · {c.name}</b><div className="meta">{c.lecturer?.name ?? "No lecturer"} · {c.enrolled} enrolled · {c.assignments.length} assignments</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(c.id)}>Open</button>
          </div>
        ))}
        {!courses.length && <p className="muted small" style={{ margin: 0 }}>No courses yet.</p>}
      </div>
    </div>
  );
}

function CourseDetail({ course, back, reload, lms }: { course: PortalCourse; back: () => void; reload: () => void; lms: boolean }) {
  const [students, setStudents] = useState<Enrolled[] | null>(null);
  const [view, setView] = useState<"work" | "content" | "attendance">("work");
  const [gradingId, setGradingId] = useState<string | null>(null);

  const loadRoster = useCallback(() => {
    api<{ students: Enrolled[] }>(`/institution/courses/${course.id}/enrolments`).then((r) => setStudents(r.students)).catch((e) => toast(e.message));
  }, [course.id]);
  useEffect(loadRoster, [loadRoster]);
  const refresh = () => { loadRoster(); reload(); };

  const grading = course.assignments.find((a) => a.id === gradingId);
  if (grading) return <Gradebook assignmentId={grading.id} back={() => { setGradingId(null); reload(); }} />;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={back}>← All courses</button>
        <h2 className="h-card" style={{ margin: 0 }}>{course.code} · {course.name}</h2>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/courses/${course.id}`, `${course.code} with its assignments and grades`, () => { back(); reload(); })}>Delete course</button>
      </div>
      {lms && <Tabs tabs={[["work", "Assignments & class list"], ["content", "Content"], ["attendance", "Attendance"]] as const} value={view} onChange={setView} label="Course sections" />}
      {view === "content" && <ContentEditor courseId={course.id} enrolled={course.enrolled} />}
      {view === "attendance" && <AttendancePanel courseId={course.id} />}

      {view === "work" && <div className="panel-grid">
        <div className="card panel">
          <h3 className="h-card">Assignments</h3>
          {course.assignments.map((a) => (
            <div key={a.id} className="list-row">
              <div><b>{a.title}</b><div className="meta">Due {fmtDateTime(a.dueAt)} · out of {a.maxMarks} · {a.graded}/{course.enrolled} graded</div></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-mint btn-sm" onClick={() => setGradingId(a.id)}>Grades</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/assignments/${a.id}`, `“${a.title}” and its grades`, reload)}>Delete</button>
              </div>
            </div>
          ))}
          {!course.assignments.length && <p className="muted small" style={{ margin: 0 }}>No assignments yet.</p>}
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            const ok = await submit(`/institution/courses/${course.id}/assignments`, {
              title: str(f, "title"), description: str(f, "description"), dueAt: colomboIso(str(f, "dueAt")), maxMarks: Number(str(f, "maxMarks") || 100),
            }, "Assignment added", reload);
            if (ok) form.reset();
          }} style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <b className="small">New assignment</b>
            <div className="form-grid">
              <div className="field full"><label htmlFor="a-title">Title</label><input className="input" id="a-title" name="title" required minLength={2} maxLength={120} /></div>
              <div className="field"><label htmlFor="a-due">Due (Sri Lanka time)</label><input className="input" id="a-due" name="dueAt" type="datetime-local" required /></div>
              <div className="field"><label htmlFor="a-max">Out of</label><input className="input" id="a-max" name="maxMarks" type="number" min={1} max={1000} defaultValue={100} /></div>
              <div className="field full"><label htmlFor="a-desc">Instructions (optional)</label><textarea className="input" id="a-desc" name="description" maxLength={4000} /></div>
            </div>
            <button className="btn btn-primary">Add assignment</button>
          </form>
        </div>

        <div className="card panel">
          <h3 className="h-card">{students ? `${students.length} enrolled` : "Loading…"}</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const numbers = str(new FormData(form), "numbers").split(/[\s,;]+/).filter(Boolean);
            if (!numbers.length) return;
            try {
              const r = await api<{ enrolled: number; notFound: string[] }>(`/institution/courses/${course.id}/enrolments`, { method: "POST", json: { studentNumbers: numbers } });
              toast(r.notFound.length ? `Enrolled ${r.enrolled}. Not found: ${r.notFound.join(", ")}` : `Enrolled ${r.enrolled}`);
              form.reset(); refresh();
            } catch (err) { toast((err as Error).message); }
          }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field">
              <label htmlFor="enrol">Enrol by student number (one per line, or comma-separated)</label>
              <textarea className="input" id="enrol" name="numbers" placeholder={"IC-2026-0142\nIC-2026-0143"} style={{ minHeight: 80 }} />
            </div>
            <button className="btn btn-primary btn-sm">Enrol students</button>
          </form>
          {students?.map((s) => (
            <div key={s.id} className="list-row">
              <div><b>{s.name}</b><div className="meta">{s.studentNumber} · {s.email}{s.verificationStatus !== "VERIFIED" ? ` · ${s.verificationStatus.toLowerCase()}` : ""}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/courses/${course.id}/enrolments/${s.id}`, `${s.name} from ${course.code} (their grades for this course too)`, refresh)}>Remove</button>
            </div>
          ))}
        </div>
      </div>}
    </>
  );
}

function Gradebook({ assignmentId, back }: { assignmentId: string; back: () => void }) {
  const [data, setData] = useState<{ assignment: { title: string; maxMarks: number }; students: GradeRow[] } | null>(null);
  const [draft, setDraft] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ assignment: { title: string; maxMarks: number }; students: GradeRow[] }>(`/institution/assignments/${assignmentId}/grades`)
      .then((r) => {
        setData(r);
        setDraft(Object.fromEntries(r.students.map((s) => [s.id, { marks: s.grade ? String(s.grade.marks) : "", feedback: s.grade?.feedback ?? "" }])));
      })
      .catch((e) => toast(e.message));
  }, [assignmentId]);

  async function save() {
    if (!data) return;
    const grades = data.students
      .filter((s) => draft[s.id]?.marks !== "")
      .map((s) => ({ studentId: s.id, marks: Number(draft[s.id].marks), feedback: draft[s.id].feedback || null }));
    if (!grades.length) return toast("Enter at least one mark");
    if (grades.some((g) => !Number.isInteger(g.marks) || g.marks < 0)) return toast("Marks must be whole numbers");
    setSaving(true);
    await submit(`/institution/assignments/${assignmentId}/grades`, { grades }, `Saved ${grades.length} ${grades.length === 1 ? "grade" : "grades"}`, () => {}, "PUT");
    setSaving(false);
  }

  if (!data) return <p className="muted">Loading grades…</p>;
  return (
    <div className="card panel">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={back}>← Back to course</button>
        <h3 className="h-card" style={{ margin: 0 }}>{data.assignment.title} · out of {data.assignment.maxMarks}</h3>
      </div>
      {data.students.length ? (
        <div style={{ overflowX: "auto" }}>
          <table className="gradebook">
            <thead><tr><th>Student</th><th>Submission</th><th>Marks</th><th>Feedback (students see this)</th></tr></thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="tiny" style={{ maxWidth: 260 }}>{s.submission
                    ? <>{s.submission.text && <div style={{ whiteSpace: "pre-line" }}>{s.submission.text.slice(0, 300)}</div>}{s.submission.link && <a href={s.submission.link} target="_blank" rel="noreferrer">Open link</a>}<div>{new Date(s.submission.submittedAt).toLocaleDateString("en-GB")}</div></>
                    : <span className="muted">Not submitted · {s.studentNumber}</span>}</td>
                  <td><input className="input grade-input" type="number" min={0} max={data.assignment.maxMarks} aria-label={`Marks for ${s.name}`}
                    value={draft[s.id]?.marks ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], marks: e.target.value } }))} /></td>
                  <td><input className="input" maxLength={2000} aria-label={`Feedback for ${s.name}`}
                    value={draft[s.id]?.feedback ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [s.id]: { ...d[s.id], feedback: e.target.value } }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted small">No students enrolled yet.</p>}
      <button className="btn btn-primary" disabled={saving || !data.students.length} onClick={save}>{saving ? "Saving…" : "Save grades"}</button>
    </div>
  );
}
