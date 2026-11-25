import type { Metadata } from "next";
import { InstitutionView } from "./InstitutionView";

export const metadata: Metadata = { title: "Institution portal" };

export default function InstitutionPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <InstitutionView />
      </section>
    </div>
  );
}
