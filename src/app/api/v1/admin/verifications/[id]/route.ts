import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

const Decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("VERIFIED"), validUntil: z.iso.date() }),
  z.object({ decision: z.literal("REJECTED") }),
]);

/** Approve or reject a pending student. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/admin/verifications/[id]">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  const d = await body(req, Decision);
  const { count } = await db.studentProfile.updateMany({
    where: { id, verificationStatus: "PENDING" },
    data:
      d.decision === "VERIFIED"
        ? { verificationStatus: "VERIFIED", verifiedAt: new Date(), validUntil: new Date(`${d.validUntil}T18:29:59Z`) }
        : { verificationStatus: "REJECTED" },
  });
  if (!count) throw new ApiError(409, "NOT_PENDING", "This student isn’t pending verification");
  return json({ ok: true, status: d.decision });
});
