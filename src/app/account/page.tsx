import type { Metadata } from "next";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head"><div className="l"><span className="eyebrow">Account</span><h1 className="h-sec page-title">Your account.</h1></div></div>
        <PasswordForm />
      </section>
    </div>
  );
}
