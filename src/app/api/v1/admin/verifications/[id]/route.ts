import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { Decision, decideVerification } from "@/lib/verification";

/** Approve or reject a pending student (platform admin: any institution). */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/admin/verifications/[id]">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  const d = await body(req, Decision);
  await decideVerification(id, d);
  return json({ ok: true, status: d.decision });
});
