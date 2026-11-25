import type { Metadata } from "next";
import { ProposalForm } from "./ProposalForm";

export const metadata: Metadata = { title: "For institutions" };

export default function ForInstitutions() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow">For institutions</span><h1 className="h-sec page-title">One platform for your whole institution.</h1></div>
          <p className="r">Verified students, Campus Life, CRM, admissions, LMS, fees, analytics and an AI assistant, all under your brand. License what you need.</p>
        </div>
        <ProposalForm />
      </section>
    </div>
  );
}
