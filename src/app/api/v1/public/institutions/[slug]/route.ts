import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { brandingOf } from "@/lib/os/branding";
import { aiConfigured } from "@/lib/ai/assistant";

/** Public enquiry-page data: branding + programmes open for enquiries. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/public/institutions/[slug]">) => {
  const { slug } = await ctx.params;
  const inst = await db.institution.findUnique({ where: { slug }, select: { id: true, modules: true } });
  if (!inst) throw new ApiError(404, "NOT_FOUND", "Institution not found");
  const [branding, programmes] = await Promise.all([
    brandingOf(inst.id),
    db.programme.findMany({
      where: { institutionId: inst.id, open: true }, orderBy: { name: "asc" },
      select: { id: true, name: true, mode: true, durationMonths: true, feeCents: true, intakes: true },
    }),
  ]);
  const assistant = aiConfigured() && inst.modules.includes("ai") && (await db.knowledgeEntry.count({ where: { institutionId: inst.id, approved: true } })) > 0;
  return json({ branding, programmes, assistant });
});
