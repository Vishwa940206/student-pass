import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { Prisma } from "@/generated/prisma/client";

const Input = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(2000).default("") });

export const POST = handler(async (req) => {
  const { institutionId } = await requireStaff();
  const input = await body(req, Input);
  try {
    return json(await db.club.create({ data: { ...input, institutionId }, select: { id: true } }), 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(409, "DUPLICATE", "A club with that name already exists");
    throw e;
  }
});
