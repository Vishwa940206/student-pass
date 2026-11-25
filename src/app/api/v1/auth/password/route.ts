import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, requireUser } from "@/lib/auth/session";
import { limit } from "@/lib/rate-limit";

const Input = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200),
});

/** Change your password. Signs out every other session (e.g. after a one-time password). */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { currentPassword, newPassword } = await body(req, Input);
  await limit("password:user", user.id, 10, 15 * 60);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Your current password is incorrect");
  }
  if (currentPassword === newPassword) throw new ApiError(400, "SAME_PASSWORD", "Choose a different password");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id); // keep this device signed in
  return json({ ok: true });
});
