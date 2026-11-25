import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { pendingSelect } from "@/lib/verification";

/** Students waiting for verification, across all institutions. */
export const GET = handler(async () => {
  await requireUser("ADMIN");
  const pending = await db.studentProfile.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: pendingSelect,
  });
  return json({ pending });
});
