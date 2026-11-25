import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { ADMISSIONS, requireStaff } from "@/lib/campus/access";
import { aiConfigured } from "@/lib/ai/assistant";
import { requireModule } from "@/lib/os/entitlements";

/** Approved knowledge + assistant stats and recent conversations. */
export const GET = handler(async () => {
  const { institutionId } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "ai");
  const [entries, total, answered, handed, recent] = await Promise.all([
    db.knowledgeEntry.findMany({ where: { institutionId }, orderBy: { createdAt: "asc" } }),
    db.conversation.count({ where: { institutionId } }),
    db.conversation.count({ where: { institutionId, answered: { gt: 0 } } }),
    db.conversation.count({ where: { institutionId, handedOver: true } }),
    db.conversation.findMany({
      where: { institutionId }, orderBy: { updatedAt: "desc" }, take: 30,
      select: { id: true, channel: true, handedOver: true, updatedAt: true, lead: { select: { id: true, name: true } }, student: { select: { user: { select: { name: true } } } },
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } } },
    }),
  ]);
  return json({ configured: aiConfigured(), stats: { conversations: total, answered, handedOver: handed, contained: total ? Math.round((100 * (total - handed)) / total) : 0 }, entries, recent });
});

export const KnowledgeInput = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(8000),
  source: z.string().trim().max(120).nullish(),
  approved: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  await requireModule(institutionId, "ai");
  const input = await body(req, KnowledgeInput);
  return json(await db.knowledgeEntry.create({ data: { ...input, source: input.source || null, institutionId }, select: { id: true } }), 201);
});
