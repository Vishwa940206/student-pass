import type { Metadata } from "next";
import { PosTill } from "./PosTill";

export const metadata: Metadata = { title: "Merchant POS" };

export default function PosPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow"><span className="idx">P</span>Partner POS</span><h1 className="h-sec page-title">Scan-to-sale.</h1></div>
          <p className="r">Enter the bill, scan the student’s live QR, and apply their offer. Holds expire after 5 minutes if the sale isn’t completed.</p>
        </div>
        <PosTill />
      </section>
    </div>
  );
}
