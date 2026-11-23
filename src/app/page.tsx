import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PassCard } from "@/components/PassCard";

const STEPS = [
  ["var(--mint)", "i-shield", "Verify once", "Sign up with your institution and student number. Once you’re verified, your pass goes live."],
  ["var(--cyan)", "i-qr", "Show your QR", "Your pass QR refreshes every 30 seconds. Screenshots stop working within a minute."],
  ["var(--lilac)", "i-gift", "Save at the till", "The cashier scans and the offer is applied. The saving shows on your pass straight away."],
] as const;

const TRUST = [
  ["A token, not your details", "Your QR never carries your name, institution or balances."],
  ["Merchants see the benefit", "They see your first name and institution to match you, and never your documents."],
  ["Freeze it instantly", "Lost your phone? Freeze your pass in one tap, and scans are declined until you unfreeze it."],
] as const;

export default function Home() {
  return (
    <div className="wrap">
      <section className="home-hero">
        <div className="hh-copy">
          <span className="pill-label"><span className="dot-g" />Sri Lanka’s student pass</span>
          <h1 className="h-hero">Your student status gets you <span className="g-text">more.</span></h1>
          <p className="lead">Student offers at cafés, cinemas, gyms and more, with one verified pass, wherever you study in Sri Lanka.</p>
          <div className="hero-ctas">
            <Link className="btn btn-mint" href="/signup">Get Student Pass <Icon name="i-arrow" size={18} /></Link>
            <Link className="btn btn-ghost" href="/offers">See what you get</Link>
          </div>
        </div>
        <div className="hh-visual" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PassCard skin="graphite" name="Your name" meta="Your institution" maxWidth={460} />
        </div>
      </section>

      <section>
        <div className="sec-head"><div className="l"><span className="eyebrow">How it works</span><h2 className="h-sec">Three steps to student prices.</h2></div></div>
        <div className="trust">
          {STEPS.map(([c, icon, h, p]) => (
            <div key={h} className="card trust-c">
              <span className="path-ic" style={{ background: c }}><Icon name={icon} /></span>
              <h3 className="h-card">{h}</h3>
              <p className="muted small">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head"><div className="l"><span className="eyebrow">Private by design</span><h2 className="h-sec">Your data stays yours.</h2></div></div>
        <div className="trust">
          {TRUST.map(([h, p]) => (
            <div key={h} className="card trust-c">
              <span className="path-ic" style={{ background: "var(--lilac)" }}><Icon name="i-shield" /></span>
              <h3 className="h-card">{h}</h3>
              <p className="muted small">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="cta-band">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
            <h2 className="h-sec" style={{ fontSize: "clamp(28px,4vw,50px)" }}>Ready when you are.</h2>
            <p style={{ margin: 0, fontWeight: 500, maxWidth: 480 }}>iOS and Android apps are coming soon. Your pass already works in the browser.</p>
          </div>
          <Link className="btn" href="/signup" style={{ background: "#1D1D1F", color: "#FFFFFF", position: "relative", zIndex: 1 }}>Get Student Pass</Link>
        </div>
      </section>
    </div>
  );
}
