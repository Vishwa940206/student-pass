import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { Decision, decideVerification } from "@/lib/verification";

/** Approve or reject one of this institution's pending students. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/verifications/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const d = await body(req, Decision);
  await decideVerification(id, d, institutionId);
  return json({ ok: true, status: d.decision });
});
