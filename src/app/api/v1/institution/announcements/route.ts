import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";

const Input = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(4000),
  pinned: z.boolean().default(false),
});

export const POST = handler(async (req) => {
  const { user, institutionId } = await requireStaff();
  const input = await body(req, Input);
  const a = await db.announcement.create({ data: { ...input, institutionId, authorId: user.id }, select: { id: true } });
  return json(a, 201);
});
