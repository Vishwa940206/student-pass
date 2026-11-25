import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";
import { Prisma } from "@/generated/prisma/client";

const Input = z.object({
  code: z.string().trim().toUpperCase().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  lecturerId: z.string().nullish(), // must be staff at this institution
});

export const POST = handler(async (req) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const input = await body(req, Input);
  if (input.lecturerId) {
    found(await db.institutionStaff.findFirst({ where: { userId: input.lecturerId, institutionId } }), "Lecturer");
  }
  try {
    const c = await db.course.create({
      data: { institutionId, code: input.code, name: input.name, lecturerId: input.lecturerId ?? null },
      select: { id: true },
    });
    return json(c, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(409, "DUPLICATE", "A course with that code already exists");
    throw e;
  }
});
