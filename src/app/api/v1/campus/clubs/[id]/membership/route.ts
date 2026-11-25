import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";

/** Join a club at your institution (idempotent). */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/campus/clubs/[id]/membership">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  found(await db.club.findFirst({ where: { id, institutionId }, select: { id: true } }), "Club");
  await db.clubMember.upsert({
    where: { clubId_studentId: { clubId: id, studentId } },
    update: {},
    create: { clubId: id, studentId },
  });
  return json({ ok: true, mine: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/campus/clubs/[id]/membership">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  await db.clubMember.deleteMany({ where: { clubId: id, studentId, club: { institutionId } } });
  return json({ ok: true, mine: false });
});
