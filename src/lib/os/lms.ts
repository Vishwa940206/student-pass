import "server-only";
import { db } from "@/lib/db";
import { found } from "@/lib/campus/access";

export const AT_RISK_ATTENDANCE = 75; // % below which a learner is flagged

/** Course in this institution, or 404. */
export const courseIn = async (id: string, institutionId: string) =>
  found(await db.course.findFirst({ where: { id, institutionId }, select: { id: true, code: true, name: true } }), "Course");

/** Attendance % per student for a course: present + late count as attended; excused sessions are left out. */
export async function attendanceByStudent(courseId: string): Promise<Map<string, { pct: number | null; attended: number; counted: number }>> {
  const rows = await db.attendance.groupBy({ by: ["studentId", "status"], where: { session: { courseId } }, _count: true });
  const out = new Map<string, { pct: number | null; attended: number; counted: number }>();
  for (const r of rows) {
    const s = out.get(r.studentId) ?? { pct: null, attended: 0, counted: 0 };
    if (r.status !== "EXCUSED") s.counted += r._count;
    if (r.status === "PRESENT" || r.status === "LATE") s.attended += r._count;
    out.set(r.studentId, s);
  }
  for (const s of out.values()) s.pct = s.counted ? Math.round((100 * s.attended) / s.counted) : null;
  return out;
}

/** Lesson completion % per student (published lessons only). */
export async function progressByStudent(courseId: string): Promise<{ total: number; done: Map<string, number> }> {
  const total = await db.lesson.count({ where: { published: true, module: { courseId } } });
  const rows = await db.lessonProgress.groupBy({ by: ["studentId"], where: { lesson: { published: true, module: { courseId } } }, _count: true });
  return { total, done: new Map(rows.map((r) => [r.studentId, r._count])) };
}
