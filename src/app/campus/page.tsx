import type { Metadata } from "next";
import { CampusView } from "./CampusView";

export const metadata: Metadata = { title: "Campus Life" };

export default function CampusPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <CampusView />
      </section>
    </div>
  );
}
