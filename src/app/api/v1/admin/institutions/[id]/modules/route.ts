import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";
import { ALL_MODULES } from "@/lib/os/modules";

/** Switch Institution OS modules on or off for an institution (licensing). */
export const PUT = handler(async (req, ctx: RouteContext<"/api/v1/admin/institutions/[id]/modules">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  const { modules } = await body(req, z.object({ modules: z.array(z.enum(ALL_MODULES as [string, ...string[]])).max(20) }));
  const { count } = await db.institution.updateMany({ where: { id }, data: { modules: [...new Set(modules)] } });
  found(count || null, "Institution");
  return json({ ok: true });
});
