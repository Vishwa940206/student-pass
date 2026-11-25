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

// Interactive previews of what's coming, served from /preview (sample data only).
const COMING = [
  ["var(--sun)", "i-cart", "Student Shop", "Course books, laptops and campus gear at student prices.", "/preview#/app?t=shop"],
  ["var(--cyan)", "i-wallet", "Pay & fees", "Pay fees and everyday costs, with a wallet and spending view.", "/preview#/app?t=pay"],
  ["var(--coral)", "i-coin", "Student loans", "Tuition, device and study-abroad finance with a clear calculator.", "/preview#/p?id=loans"],
  ["var(--mint)", "i-star", "Pass Points", "Earn on what you already do and spend points on perks.", "/preview#/app?t=rewards"],
  ["var(--lilac)", "i-path", "Pathways", "Find your course, compare programmes and apply once.", "/preview#/pathways"],
  ["var(--pink)", "i-book", "Campus Life", "Courses, assignments, grades, clubs and events in one place.", "/preview#/life"],
  ["var(--cyan)", "i-brief", "Jobs, housing & more", "Internships, student housing, transport and data plans.", "/preview#/app?t=more"],
  ["var(--sun)", "i-brain", "Institution OS", "One platform for enquiries, enrolment and learning.", "/preview#/suite"],
  ["var(--mint)", "i-biz", "For merchants", "Reach every verified student with scan-to-sale offers.", "/preview#/business"],
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
        <div className="sec-head">
          <div className="l">
            <span className="eyebrow">Coming soon</span>
            <h2 className="h-sec">Everything a student needs, in one place.</h2>
          </div>
        </div>
        <p className="muted" style={{ margin: "-8px 0 20px", maxWidth: 560 }}>
          Try interactive previews of what we’re building next. They use sample data, so nothing you do there is saved or charged.
        </p>
        <div className="coming">
          {COMING.map(([c, icon, h, p, href]) => (
            <a key={h} className="card trust-c hover" href={href}>
              <span className="path-ic" style={{ background: c }}><Icon name={icon} /></span>
              <h3 className="h-card">{h}</h3>
              <p className="muted small">{p}</p>
              <span className="small" style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                Preview <Icon name="i-arrow" size={14} />
              </span>
            </a>
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
