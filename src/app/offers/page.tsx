import type { Metadata } from "next";
import { Suspense } from "react";
import { OffersBrowser } from "./OffersBrowser";

export const metadata: Metadata = { title: "Offers" };

export default function OffersPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow"><span className="idx">B</span>Benefits</span><h1 className="h-sec page-title">Explore offers.</h1></div>
          <p className="r">Browse before you sign up. Each offer goes live only after its terms and Sri Lankan availability are confirmed.</p>
        </div>
        {/* OffersBrowser reads ?saved=1 (useSearchParams), which needs a Suspense boundary. */}
        <Suspense fallback={<p className="muted">Loading offers…</p>}><OffersBrowser /></Suspense>
      </section>
    </div>
  );
}
