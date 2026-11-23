import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Get Student Pass" };

export default function SignupPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow"><span className="idx">M</span>My Pass</span><h1 className="h-sec page-title">Unlock your pass.</h1></div>
          <p className="r">For currently enrolled higher-education students in Sri Lanka. Sign up once, and your pass goes live when your student status is verified.</p>
        </div>
        <SignupForm />
      </section>
    </div>
  );
}
