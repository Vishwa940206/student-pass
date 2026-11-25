import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Open jobs and housing. Public listings for everyone; institution-only listings for that
 * institution's verified students. `mine` flags listings the signed-in student responded to.
 */
export const GET = handler(async (req) => {
  const kind = new URL(req.url).searchParams.get("kind");
  const user = await getCurrentUser();
  const student = user?.role === "STUDENT"
    ? await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true, institutionId: true, verificationStatus: true } })
    : null;
  const inst = student?.verificationStatus === "VERIFIED" ? student.institutionId : null;
  const listings = await db.listing.findMany({
    where: {
      open: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(kind === "JOB" || kind === "HOUSING" ? { kind } : {}),
      AND: [{ OR: [{ institutionId: null }, ...(inst ? [{ institutionId: inst }] : [])] }],
    },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, kind: true, title: true, organisation: true, description: true, district: true, pay: true, institutionId: true, createdAt: true,
      ...(student && { responses: { where: { studentId: student.id }, select: { createdAt: true } } }) },
  });
  return json({ canRespond: Boolean(inst), listings: listings.map(({ responses, ...l }) => ({ ...l, responded: Boolean(responses?.length) })) });
});
