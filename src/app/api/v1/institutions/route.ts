import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";

export const GET = handler(async () => {
  const institutions = await db.institution.findMany({
    select: { id: true, name: true, shortName: true, district: true, type: true },
    orderBy: { name: "asc" },
  });
  return json({ institutions });
});
