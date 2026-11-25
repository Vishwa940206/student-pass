import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

/** Class list. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/institution/courses/[id]/enrolments">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  found(await db.course.findFirst({ where: { id, institutionId }, select: { id: true } }), "Course");
  const rows = await db.enrolment.findMany({
    where: { courseId: id },
    orderBy: { student: { studentNumber: "asc" } },
    select: { enrolledAt: true, student: { select: { id: true, studentNumber: true, verificationStatus: true, user: { select: { name: true, email: true } } } } },
  });
  return json({
    students: rows.map(({ student: s, enrolledAt }) => ({
      id: s.id, studentNumber: s.studentNumber, verificationStatus: s.verificationStatus,
      name: s.user.name, email: s.user.email, enrolledAt,
    })),
  });
});

const Input = z.object({ studentNumbers: z.array(z.string().trim().min(1).max(40)).min(1).max(500) });

/** Enrol students by student number (this institution only). Reports numbers that didn't match. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/courses/[id]/enrolments">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  found(await db.course.findFirst({ where: { id, institutionId }, select: { id: true } }), "Course");
  const { studentNumbers } = await body(req, Input);
  const wanted = [...new Set(studentNumbers)];
  const students = await db.studentProfile.findMany({
    where: { institutionId, studentNumber: { in: wanted } },
    select: { id: true, studentNumber: true },
  });
  if (!students.length) throw new ApiError(404, "NO_MATCH", "None of those student numbers belong to your institution");
  const { count } = await db.enrolment.createMany({ data: students.map((s) => ({ courseId: id, studentId: s.id })), skipDuplicates: true });
  const matched = new Set(students.map((s) => s.studentNumber));
  return json({ enrolled: count, notFound: wanted.filter((n) => !matched.has(n)) });
});
