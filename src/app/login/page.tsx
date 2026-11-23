import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <div className="sec-head"><div className="l"><span className="eyebrow">Welcome back</span><h1 className="h-sec page-title">Sign in.</h1></div></div>
        <LoginForm />
      </section>
    </div>
  );
}
