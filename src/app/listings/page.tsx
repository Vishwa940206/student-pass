import type { Metadata } from "next";
import { ListingsManager } from "./ListingsManager";

export const metadata: Metadata = { title: "Post jobs & housing" };

export default function ListingsPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow">Jobs &amp; housing</span><h1 className="h-sec page-title">Post to verified students.</h1></div>
          <p className="r">For Student Pass partners, institution admins and merchants. Students apply in the app; you see their message and contact details here.</p>
        </div>
        <ListingsManager />
      </section>
    </div>
  );
}
