import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export const GET = handler(async () => {
  await requireUser("ADMIN");
  const rewards = await db.reward.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { redemptions: true } } } });
  return json({ rewards: rewards.map(({ _count, ...r }) => ({ ...r, redeemed: _count.redemptions })) });
});

export const RewardInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  cost: z.int().min(1).max(1_000_000),
  stock: z.int().min(0).max(1_000_000).nullish(),
  active: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  await requireUser("ADMIN");
  const input = await body(req, RewardInput);
  return json(await db.reward.create({ data: { ...input, stock: input.stock ?? null }, select: { id: true } }), 201);
});
