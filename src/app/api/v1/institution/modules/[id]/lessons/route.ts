import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

export const LessonInput = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().max(20_000).default(""),
  url: z.url({ protocol: /^https?$/ }).nullish().or(z.literal("").transform(() => null)),
  published: z.boolean().default(true),
});

export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/modules/[id]/lessons">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  found(await db.courseModule.findFirst({ where: { id, course: { institutionId } }, select: { id: true } }), "Module");
  const input = await body(req, LessonInput);
  const position = await db.lesson.count({ where: { moduleId: id } });
  return json(await db.lesson.create({ data: { ...input, url: input.url ?? null, moduleId: id, position }, select: { id: true } }), 201);
});
