import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { createStaffAccount } from "@/lib/campus/staff";

const Input = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(80),
  staffRole: z.enum(["ADMIN", "LECTURER"]).default("LECTURER"),
});

/** Institution admins add staff to their own institution. Returns a one-time password. */
export const POST = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  const input = await body(req, Input);
  return json(await createStaffAccount({ ...input, institutionId }), 201);
});
