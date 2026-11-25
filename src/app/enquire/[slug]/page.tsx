import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = { title: "Enquire" };

export default function EnquirePage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <Suspense fallback={<p className="muted">Loading…</p>}><EnquiryForm /></Suspense>
      </section>
    </div>
  );
}
