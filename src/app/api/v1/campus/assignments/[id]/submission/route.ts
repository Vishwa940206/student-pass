import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";

const Input = z.object({
  text: z.string().trim().max(20_000).default(""),
  link: z.url({ protocol: /^https?$/ }).nullish().or(z.literal("").transform(() => null)),
}).refine((v) => v.text || v.link, { message: "Add your work as text or a link", path: ["text"] });

/** Submit or resubmit work for an assignment in one of your courses. Locked once graded. */
export const PUT = handler(async (req, ctx: RouteContext<"/api/v1/campus/assignments/[id]/submission">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  const a = found(await db.assignment.findFirst({
    where: { id, course: { institutionId, enrolments: { some: { studentId } } } },
    select: { dueAt: true, grades: { where: { studentId }, select: { marks: true } } },
  }), "Assignment");
  if (a.grades.length) throw new ApiError(409, "GRADED", "This assignment has been graded, so it can’t be changed");
  const input = await body(req, Input);
  const s = await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: id, studentId } },
    update: { text: input.text, link: input.link ?? null },
    create: { assignmentId: id, studentId, text: input.text, link: input.link ?? null },
    select: { submittedAt: true },
  });
  return json({ submittedAt: s.submittedAt, late: s.submittedAt > a.dueAt });
});
