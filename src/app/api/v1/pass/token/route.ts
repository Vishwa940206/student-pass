import { db } from "@/lib/db";
import { ApiError, handler } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { issueToken } from "@/lib/pass-token";

/** The live QR token for the signed-in student. The app refreshes it every 30 s. */
export const GET = handler(async () => {
  const user = await requireUser("STUDENT");
  const student = await db.studentProfile.findUnique({ where: { userId: user.id } });
  if (!student) throw new ApiError(404, "NO_PASS", "No student profile");
  if (student.verificationStatus !== "VERIFIED") {
    throw new ApiError(403, "NOT_VERIFIED", "Your pass activates once your student status is verified");
  }
  if (student.passState === "FROZEN") throw new ApiError(423, "PASS_FROZEN", "Your pass is frozen");
  const { token, expiresAtMs } = issueToken(student.passId);
  return new Response(JSON.stringify({ token, expiresAt: new Date(expiresAtMs).toISOString() }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
});
