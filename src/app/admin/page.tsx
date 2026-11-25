import type { Metadata } from "next";
import { VerificationQueue } from "./VerificationQueue";
import { InstitutionAccounts } from "./InstitutionAccounts";
import { PlatformOs } from "./PlatformOs";

export const metadata: Metadata = { title: "Verifications" };

export default function AdminPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head">
          <div className="l"><span className="eyebrow"><span className="idx">A</span>Admin</span><h1 className="h-sec page-title">Verifications.</h1></div>
          <p className="r">Check each student against their institution’s records before approving. Approved passes go live immediately.</p>
        </div>
        <VerificationQueue />
        <InstitutionAccounts />
        <PlatformOs />
      </section>
    </div>
  );
}
