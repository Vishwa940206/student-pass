import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";

/** RSVP to an event at your institution. Capacity is checked under a row lock. */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/campus/events/[id]/rsvp">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;

  await db.$transaction(async (tx) => {
    // Lock the event row so two last-seat RSVPs can't both succeed.
    const [row] = await tx.$queryRaw<{ id: string; capacity: number | null }[]>`
      SELECT id, capacity FROM "Event" WHERE id = ${id} AND "institutionId" = ${institutionId} FOR UPDATE`;
    const event = found(row, "Event");
    const already = await tx.eventRsvp.findUnique({ where: { eventId_studentId: { eventId: id, studentId } } });
    if (already) return;
    if (event.capacity !== null && (await tx.eventRsvp.count({ where: { eventId: id } })) >= event.capacity) {
      throw new ApiError(409, "FULL", "This event is full");
    }
    await tx.eventRsvp.create({ data: { eventId: id, studentId } });
  });
  return json({ ok: true, mine: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/campus/events/[id]/rsvp">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  await db.eventRsvp.deleteMany({ where: { eventId: id, studentId, event: { institutionId } } });
  return json({ ok: true, mine: false });
});
