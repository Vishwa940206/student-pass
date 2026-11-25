import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopView } from "./ShopView";

export const metadata: Metadata = { title: "Student Shop" };

export default function ShopPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow">Student Shop</span><h1 className="h-sec page-title">Student prices on everything you study with.</h1></div>
          <p className="r">Reserve at the student price, then pay and collect at the shop with your pass. Your reservation holds stock for 7 days.</p>
        </div>
        <Suspense fallback={<p className="muted">Loading the shop…</p>}><ShopView /></Suspense>
      </section>
    </div>
  );
}
