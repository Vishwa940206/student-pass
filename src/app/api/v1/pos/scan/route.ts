import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { scan } from "@/lib/pos/service";

const Scan = z.object({
  token: z.string().min(1).max(200),
  locationId: z.string().min(1),
  subtotalCents: z.int().min(0).max(100_000_000),
});

/** Dry run: who is this, and which offers apply to this basket? Reserves nothing. */
export const POST = handler(async (req) => {
  const staff = await requireStaff();
  return json(await scan(staff, await body(req, Scan)));
});
