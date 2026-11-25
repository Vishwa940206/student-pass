import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { chatTurn } from "@/lib/ai/chat";
import { clientIp, limit } from "@/lib/rate-limit";

const Input = z.object({ conversationId: z.string().max(40).optional(), message: z.string().trim().min(1).max(1000) });

/** Public assistant on the enquiry page (no personal data). Rate-limited per IP and per institution. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/public/institutions/[slug]/chat">) => {
  const { slug } = await ctx.params;
  await limit("chat:ip", clientIp(req), 30, 60 * 60);
  const input = await body(req, Input);
  const inst = await db.institution.findUnique({ where: { slug }, select: { id: true } });
  if (!inst) throw new ApiError(404, "NOT_FOUND", "Institution not found");
  await limit("chat:inst", inst.id, 2000, 24 * 60 * 60);
  return json(await chatTurn({ institutionId: inst.id, channel: "PUBLIC", conversationId: input.conversationId, message: input.message }));
});
