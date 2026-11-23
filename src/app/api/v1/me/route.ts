import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";

export const GET = handler(async () => {
  // Signed-out is a normal state here, not an error: { user: null }.
  const user = await getCurrentUser();
  if (!user) return json({ user: null, student: null });
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
