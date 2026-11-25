import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { CAMPUS, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";
import { courseIn } from "@/lib/os/lms";

/** Course content: modules with their lessons, in order. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/institution/courses/[id]/content">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  await requireModule(institutionId, "lms");
  const { id } = await ctx.params;
  await courseIn(id, institutionId);
  const modules = await db.courseModule.findMany({
    where: { courseId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, position: true, lessons: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, body: true, url: true, published: true, position: true, _count: { select: { progress: true } } } } },
  });
  return json({ modules: modules.map((m) => ({ ...m, lessons: m.lessons.map(({ _count, ...l }) => ({ ...l, completed: _count.progress })) })) });
});

/** Add a module (week / unit) at the end. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/courses/[id]/content">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  await requireModule(institutionId, "lms");
  const { id } = await ctx.params;
  await courseIn(id, institutionId);
  const { title } = await body(req, z.object({ title: z.string().trim().min(2).max(120) }));
  const position = await db.courseModule.count({ where: { courseId: id } });
  return json(await db.courseModule.create({ data: { courseId: id, title, position }, select: { id: true } }), 201);
});
