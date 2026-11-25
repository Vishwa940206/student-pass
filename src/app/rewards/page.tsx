import type { Metadata } from "next";
import { RewardsView } from "./RewardsView";

export const metadata: Metadata = { title: "Pass Points" };

export default function RewardsPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow">Pass Points</span><h1 className="h-sec page-title">Earn on everything you already do.</h1></div>
          <p className="r">Points for every offer you redeem, every fee you pay and every shop order you collect. Spend them on rewards.</p>
        </div>
        <RewardsView />
      </section>
    </div>
  );
}
