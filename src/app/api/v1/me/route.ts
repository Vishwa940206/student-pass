import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export const GET = handler(async () => {
  const user = await requireUser();
  const student = await db.studentProfile.findUnique({
    where: { userId: user.id },
    select: {
      studentNumber: true,
      programme: true,
      verificationStatus: true,
      validUntil: true,
      passState: true,
      cardSkin: true,
      institution: { select: { id: true, name: true, shortName: true } },
    },
  });
  return json({ user, student });
});
