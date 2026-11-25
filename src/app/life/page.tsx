import type { Metadata } from "next";
import { LifeView } from "./LifeView";

export const metadata: Metadata = { title: "Jobs, housing & more" };

export default function LifePage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow">Jobs, housing &amp; more</span><h1 className="h-sec page-title">Everything around your studies, sorted.</h1></div>
          <p className="r">Part-time work that fits your timetable and places to live near campus, posted by your institution and partners.</p>
        </div>
        <LifeView />
      </section>
    </div>
  );
}
