import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";

/**
 * Removes someone's access to this institution. The account stays (their announcements and
 * grades keep an author) but can no longer use the portal, and their sessions end.
 */
export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/staff/[userId]">) => {
  const { user, institutionId } = await requireStaff("ADMIN");
  const { userId } = await ctx.params;
  if (userId === user.id) throw new ApiError(400, "SELF", "You can’t remove yourself");
  await db.$transaction(async (tx) => {
    const { count } = await tx.institutionStaff.deleteMany({ where: { userId, institutionId } });
    found(count || null, "Staff member");
    await tx.course.updateMany({ where: { lecturerId: userId, institutionId }, data: { lecturerId: null } });
    await tx.session.deleteMany({ where: { userId } });
  });
  return json({ ok: true });
});
