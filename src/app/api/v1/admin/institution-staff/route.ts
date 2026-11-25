import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createStaffAccount } from "@/lib/campus/staff";

/** Every institution staff account (platform admin view). */
export const GET = handler(async () => {
  await requireUser("ADMIN");
  const staff = await db.institutionStaff.findMany({
    orderBy: [{ institution: { name: "asc" } }, { createdAt: "asc" }],
    select: {
      staffRole: true, createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      institution: { select: { id: true, name: true, shortName: true } },
    },
  });
  return json({ staff: staff.map((s) => ({ ...s.user, staffRole: s.staffRole, createdAt: s.createdAt, institution: s.institution })) });
});

const Input = z.object({
  institutionId: z.string().min(1),
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(80),
  staffRole: z.enum(["ADMIN", "LECTURER"]).default("ADMIN"),
});

/** Create an institution's first admin (or any staff). Returns a one-time password. */
export const POST = handler(async (req) => {
  await requireUser("ADMIN");
  const input = await body(req, Input);
  if (!(await db.institution.findUnique({ where: { id: input.institutionId }, select: { id: true } }))) {
    throw new ApiError(400, "UNKNOWN_INSTITUTION", "Choose an institution from the list");
  }
  return json(await createStaffAccount(input), 201);
});
