import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export const GET = handler(async () => {
  await requireUser("ADMIN");
  const requests = await db.proposalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return json({ requests });
});
