import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

/** Students waiting for verification. */
export const GET = handler(async () => {
  await requireUser("ADMIN");
  const pending = await db.studentProfile.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, studentNumber: true, programme: true, createdAt: true,
      user: { select: { name: true, email: true } },
      institution: { select: { name: true, shortName: true } },
    },
  });
  return json({ pending });
});
