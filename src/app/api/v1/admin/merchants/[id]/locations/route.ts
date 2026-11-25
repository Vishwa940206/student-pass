import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";
import { Prisma } from "@/generated/prisma/client";
import { Branch } from "../../route";

export const POST = handler(async (req, ctx: RouteContext<"/api/v1/admin/merchants/[id]/locations">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  found(await db.merchant.findUnique({ where: { id }, select: { id: true } }), "Merchant");
  const b = await body(req, Branch);
  try {
    return json(await db.merchantLocation.create({ data: { ...b, merchantId: id }, select: { id: true } }), 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(409, "DUPLICATE", "That branch code is already used");
    throw e;
  }
});
