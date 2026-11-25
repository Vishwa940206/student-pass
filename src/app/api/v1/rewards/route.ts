import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { balance, RULES, tierOf } from "@/lib/points";

/** Pass Points: balance, tier, history, rewards to spend on, and the student's own rewards. */
export const GET = handler(async () => {
  const { studentId } = await requireCampusStudent();
  const [b, history, rewards, mine] = await Promise.all([
    balance(studentId),
    db.pointsEntry.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, delta: true, reason: true, note: true, createdAt: true } }),
    db.reward.findMany({ where: { active: true }, orderBy: { cost: "asc" }, select: { id: true, title: true, description: true, cost: true, stock: true } }),
    db.rewardRedemption.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, code: true, cost: true, status: true, createdAt: true, reward: { select: { title: true } } } }),
  ]);
  return json({ ...b, tier: tierOf(b.lifetime), rules: RULES, history, rewards, mine });
});
