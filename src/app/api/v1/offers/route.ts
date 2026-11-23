import { handler, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { listOffers, OfferQuery } from "@/lib/offers";

/** Public: anyone can browse offers before signing up. */
export const GET = handler(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = OfferQuery.parse(params);
  const user = await getCurrentUser();
  return json({ offers: await listOffers(query, user?.id) });
});
