import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";
import { RewardInput } from "../route";

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/admin/rewards/[id]">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  const p = await body(req, RewardInput.partial());
  const { count } = await db.reward.updateMany({ where: { id }, data: p });
  found(count || null, "Reward");
  return json({ ok: true });
});
