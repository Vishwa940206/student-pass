import type { Metadata } from "next";
import { Suspense } from "react";
import { PayView } from "./PayView";

export const metadata: Metadata = { title: "Pay a student fee", robots: { index: false, follow: false } };

export default function PayPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <Suspense fallback={<p className="muted">Loading…</p>}><PayView /></Suspense>
      </section>
    </div>
  );
}
