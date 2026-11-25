import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

/** Institutions with their licensed modules and usage counts (platform admin). */
export const GET = handler(async () => {
  await requireUser("ADMIN");
  const rows = await db.institution.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, modules: true, _count: { select: { staff: true, students: true, leads: true } } },
  });
  return json({ institutions: rows.map(({ _count, ...i }) => ({ ...i, staff: _count.staff, students: _count.students, leads: _count.leads })) });
});
