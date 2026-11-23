import { z } from "zod";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { authorize } from "@/lib/pos/service";

const Authorize = z.object({
  token: z.string().min(1).max(200),
  offerId: z.string().min(1),
  locationId: z.string().min(1),
  subtotalCents: z.int().min(0).max(100_000_000),
});

/**
 * Reserve a discount for this basket. Send an `Idempotency-Key` header (any
 * unique string per attempt); a retry with the same key returns the same hold.
 */
export const POST = handler(async (req) => {
  const staff = await requireStaff();
  const key = req.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 100) {
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header (8–100 chars)");
  }
  const auth = await authorize(staff, { ...(await body(req, Authorize)), idempotencyKey: key });
  return json({ authorization: auth }, 201);
});
