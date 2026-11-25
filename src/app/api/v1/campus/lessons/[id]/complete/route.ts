import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";

async function lessonFor(id: string, studentId: string, institutionId: string) {
  return found(await db.lesson.findFirst({
    where: { id, published: true, module: { course: { institutionId, enrolments: { some: { studentId } } } } },
    select: { id: true },
  }), "Lesson");
}

export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/campus/lessons/[id]/complete">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  await lessonFor(id, studentId, institutionId);
  await db.lessonProgress.upsert({ where: { lessonId_studentId: { lessonId: id, studentId } }, update: {}, create: { lessonId: id, studentId } });
  return json({ done: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/campus/lessons/[id]/complete">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  await lessonFor(id, studentId, institutionId);
  await db.lessonProgress.deleteMany({ where: { lessonId: id, studentId } });
  return json({ done: false });
});
