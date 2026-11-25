import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientIp, limit } from "@/lib/rate-limit";
import { Prisma } from "@/generated/prisma/client";

const Signup = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(200),
  institutionId: z.string().min(1),
  studentNumber: z.string().trim().min(3).max(40),
  programme: z.string().trim().max(120).optional(),
});

/** Students sign up; their status starts PENDING until verified. */
export const POST = handler(async (req) => {
  const input = await body(req, Signup);
  await limit("signup:ip", clientIp(req), 10, 60 * 60);
  const institution = await db.institution.findUnique({ where: { id: input.institutionId } });
  if (!institution) throw new ApiError(400, "UNKNOWN_INSTITUTION", "Choose your institution from the list");

  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: "STUDENT",
        student: {
          create: { institutionId: institution.id, studentNumber: input.studentNumber, programme: input.programme },
        },
      },
    });
    await createSession(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email } }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Don't reveal which field collided beyond what's needed to fix it.
      throw new ApiError(409, "ALREADY_REGISTERED", "That email or student number is already registered");
    }
    throw e;
  }
});
