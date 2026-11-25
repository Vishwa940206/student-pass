import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { found } from "@/lib/campus/access";
import { requirePoster } from "@/lib/listings";

/** Open / close a listing (own listings; platform admins: any). */
export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/listings/[id]">) => {
  const { user } = await requirePoster();
  const { id } = await ctx.params;
  const { open } = await body(req, z.object({ open: z.boolean() }));
  const { count } = await db.listing.updateMany({ where: { id, ...(user.role !== "ADMIN" && { postedById: user.id }) }, data: { open } });
  found(count || null, "Listing");
  return json({ ok: true });
});
