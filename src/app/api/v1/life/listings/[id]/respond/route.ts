import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { limit } from "@/lib/rate-limit";

const Input = z.object({ message: z.string().trim().min(10, "Say a little about yourself (10+ characters)").max(2000), phone: z.string().trim().max(30).optional() });

/** Apply for a job / enquire about housing. One response per listing. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/life/listings/[id]/respond">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  await limit("listing:student", studentId, 30, 24 * 60 * 60);
  const { id } = await ctx.params;
  const input = await body(req, Input);
  const l = await db.listing.findFirst({ where: { id, open: true, OR: [{ institutionId: null }, { institutionId }] }, select: { id: true } });
  if (!l) throw new ApiError(404, "NOT_FOUND", "This listing isn’t open");
  try {
    await db.listingResponse.create({ data: { listingId: id, studentId, message: input.message, phone: input.phone || null } });
  } catch {
    throw new ApiError(409, "ALREADY", "You’ve already responded to this listing");
  }
  return json({ ok: true }, 201);
});
