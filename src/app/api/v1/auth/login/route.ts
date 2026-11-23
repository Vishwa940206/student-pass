import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const Login = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(200) });

// Hash of a random password, so unknown emails take the same time as wrong passwords.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export const POST = handler(async (req) => {
  const { email, password } = await body(req, Login);
  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  await createSession(user.id);
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
