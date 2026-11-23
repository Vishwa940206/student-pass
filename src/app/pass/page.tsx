import type { Metadata } from "next";
import { PassView } from "./PassView";

export const metadata: Metadata = { title: "My Pass" };

export default function PassPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <PassView />
      </section>
    </div>
  );
}
