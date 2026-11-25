import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";
import { humanCode } from "@/lib/codes";
import { award, balance } from "@/lib/points";
import { limit } from "@/lib/rate-limit";

/** Spend points on a reward. Balance and stock are checked under locks, so double-clicks can't overspend. */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/rewards/[id]/redeem">) => {
  const { studentId } = await requireCampusStudent();
  await limit("reward:student", studentId, 20, 60 * 60);
  const { id } = await ctx.params;
  const r = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"points:" + studentId}))`;
    const [reward] = await tx.$queryRaw<{ id: string; title: string; cost: number; stock: number | null; active: boolean }[]>`
      SELECT id, title, cost, stock, active FROM "Reward" WHERE id = ${id} FOR UPDATE`;
    const rw = found(reward, "Reward");
    if (!rw.active) throw new ApiError(409, "INACTIVE", "This reward isn’t available any more");
    if (rw.stock !== null && rw.stock < 1) throw new ApiError(409, "SOLD_OUT", "This reward has run out");
    const { balance: have } = await balance(studentId, tx);
    if (have < rw.cost) throw new ApiError(409, "NOT_ENOUGH", `You need ${rw.cost - have} more points`);
    if (rw.stock !== null) await tx.reward.update({ where: { id }, data: { stock: { decrement: 1 } } });
    const red = await tx.rewardRedemption.create({ data: { rewardId: id, studentId, code: humanCode(), cost: rw.cost }, select: { id: true, code: true } });
    await award(tx, studentId, "REWARD", red.id, -rw.cost, rw.title);
    return red;
  });
  return json(r, 201);
});
