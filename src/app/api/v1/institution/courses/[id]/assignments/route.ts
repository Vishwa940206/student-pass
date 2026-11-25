import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";

const Input = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(""),
  dueAt: z.iso.datetime({ offset: true }),
  maxMarks: z.int().min(1).max(1000).default(100),
});

export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/courses/[id]/assignments">) => {
  const { institutionId } = await requireStaff();
  const { id } = await ctx.params;
  found(await db.course.findFirst({ where: { id, institutionId }, select: { id: true } }), "Course");
  const a = await body(req, Input);
  const row = await db.assignment.create({ data: { ...a, dueAt: new Date(a.dueAt), courseId: id }, select: { id: true } });
  return json(row, 201);
});
