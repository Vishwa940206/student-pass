import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { pendingSelect } from "@/lib/verification";

/** Students at this institution waiting for verification. */
export const GET = handler(async () => {
  const { institutionId } = await requireStaff("ADMIN");
  const pending = await db.studentProfile.findMany({
    where: { institutionId, verificationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: pendingSelect,
  });
  return json({ pending });
});
