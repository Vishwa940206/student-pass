import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

/** Lost phone? The student can freeze their pass instantly; merchants then see PASS_FROZEN. */
export const POST = handler(async (req) => {
  const user = await requireUser("STUDENT");
  const { frozen } = await body(req, z.object({ frozen: z.boolean() }));
  const s = await db.studentProfile.update({
    where: { userId: user.id },
    data: { passState: frozen ? "FROZEN" : "ACTIVE" },
    select: { passState: true },
  });
  return json(s);
});
