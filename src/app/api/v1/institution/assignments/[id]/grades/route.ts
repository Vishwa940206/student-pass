import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

async function assignmentIn(id: string, institutionId: string) {
  return found(
    await db.assignment.findFirst({ where: { id, course: { institutionId } }, select: { id: true, courseId: true, title: true, maxMarks: true } }),
    "Assignment",
  );
}

/** Gradebook: every enrolled student with their grade (if any). */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/institution/assignments/[id]/grades">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const a = await assignmentIn(id, institutionId);
  const rows = await db.enrolment.findMany({
    where: { courseId: a.courseId },
    orderBy: { student: { studentNumber: "asc" } },
    select: {
      student: {
        select: {
          id: true, studentNumber: true, user: { select: { name: true } },
          grades: { where: { assignmentId: id }, select: { marks: true, feedback: true } },
        },
      },
    },
  });
  return json({
    assignment: a,
    students: rows.map(({ student: s }) => ({ id: s.id, studentNumber: s.studentNumber, name: s.user.name, grade: s.grades[0] ?? null })),
  });
});

const Input = z.object({
  grades: z.array(z.object({
    studentId: z.string().min(1),
    marks: z.int().min(0),
    feedback: z.string().trim().max(2000).nullish(),
  })).min(1).max(500),
});

/** Save grades for enrolled students. Marks can't exceed the assignment's maximum. */
export const PUT = handler(async (req, ctx: RouteContext<"/api/v1/institution/assignments/[id]/grades">) => {
  const { user, institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const a = await assignmentIn(id, institutionId);
  const { grades } = await body(req, Input);
  if (grades.some((g) => g.marks > a.maxMarks)) throw new ApiError(400, "TOO_HIGH", `Marks can’t be more than ${a.maxMarks}`);

  const enrolled = new Set(
    (await db.enrolment.findMany({ where: { courseId: a.courseId, studentId: { in: grades.map((g) => g.studentId) } }, select: { studentId: true } }))
      .map((e) => e.studentId),
  );
  const notEnrolled = grades.filter((g) => !enrolled.has(g.studentId));
  if (notEnrolled.length) throw new ApiError(400, "NOT_ENROLLED", "Some students aren’t enrolled in this course");

  await db.$transaction(grades.map((g) => db.grade.upsert({
    where: { assignmentId_studentId: { assignmentId: id, studentId: g.studentId } },
    update: { marks: g.marks, feedback: g.feedback ?? null, gradedById: user.id },
    create: { assignmentId: id, studentId: g.studentId, marks: g.marks, feedback: g.feedback ?? null, gradedById: user.id },
  })));
  return json({ saved: grades.length });
});
