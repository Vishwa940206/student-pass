import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";
import { KnowledgeInput } from "../route";

/** Edit or approve / withdraw an entry. Withdrawn entries stop being used immediately. */
export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/knowledge/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const p = await body(req, KnowledgeInput.partial());
  const { count } = await db.knowledgeEntry.updateMany({ where: { id, institutionId }, data: p });
  found(count || null, "Entry");
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/knowledge/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const { count } = await db.knowledgeEntry.deleteMany({ where: { id, institutionId } });
  found(count || null, "Entry");
  return json({ ok: true });
});
