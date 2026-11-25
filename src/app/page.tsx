import Link from "next/link";
import { Icon } from "@/components/Icon";
import { area, FAQ, FEATURED, GAINS, lkr, MOMENTS, QUICK } from "@/lib/design";
import { HomeDeals, HomeMoney, HomeStats, HomeWallet } from "./home/HomeLive";
import { HomeSearch, HomeStory } from "./home/HomeClient";

/** The super-app home from the design prototype, with live data where the backend exists. */
export default function Home() {
  return (
    <div className="wrap">
      <section className="home-hero">
        <div className="hh-copy">
          <span className="pill-label"><span className="dot-g" />Sri Lanka’s student super app</span>
          <h1 className="h-hero">Your student status gets you <span className="g-text">more.</span></h1>
          <p className="lead">Offers, student prices, fee payments, student loans and rewards: one app and one verified pass, wherever you study in Sri Lanka.</p>
          <HomeSearch />
          <div className="hero-ctas">
            <Link className="btn btn-mint" href="/signup">Get Student Pass <Icon name="i-arrow" size={18} /></Link>
            <Link className="btn btn-ghost" href="/offers">See what you get</Link>
          </div>
        </div>
        <div className="hh-visual"><HomeWallet /></div>
      </section>

      <section className="sec-tight">
        <div className="home-quick">
          {QUICK.map(([label, icon, href, tint]) => (
            <a key={label} className="hq" href={href}><span className="hq-ic" style={{ background: tint }}><Icon name={icon} size={24} /></span><span>{label}</span></a>
          ))}
        </div>
      </section>

      <section className="sec-tight"><HomeStory /></section>

      <section>
        <div className="sec-head reveal"><div className="l"><span className="eyebrow">What you gain</span><h2 className="h-sec">Everything a student needs, in one place.</h2></div>
          <p className="r">Save on everyday spending, shop at student prices, pay fees your way, borrow responsibly and earn rewards, all with one verified pass.</p></div>
        <div className="gains">
          {GAINS.map(([id, title, text]) => {
            const p = area(id);
            return (
              <a key={id} className="card gain hover reveal" href={p.href}>
                <span className="mi-ic" style={{ background: p.tint }}><Icon name={p.icon} size={20} /></span>
                <h3 className="h-card">{title}</h3><p className="muted small">{text}</p>
                <span className="link-more">Learn more <Icon name="i-arrow" size={16} /></span>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <div className="row-head reveal"><h2 className="h-row">Deals for you</h2><Link className="link-more" href="/offers">All offers <Icon name="i-arrow" size={16} /></Link></div>
        <HomeDeals />
      </section>

      <section>
        <div className="row-head reveal"><h2 className="h-row">Student prices</h2><a className="link-more" href="/preview#/app?t=shop">Open the shop <Icon name="i-arrow" size={16} /></a></div>
        <div className="hrow">
          {FEATURED.map((p) => (
            <div key={p.id} className="hrow-item">
              <a className="card prod hover" href="/preview#/app?t=shop" style={{ textDecoration: "none", color: "inherit" }} aria-label={`${p.name}, ${lkr(p.price)}`}>
                <div className="art" style={{ background: p.color }}><div className="shape" />{p.tag && <span className="tag badge" style={{ background: "#0B0B10", color: "#F5F5F7" }}>{p.tag}</span>}<span className="big">{p.big}</span></div>
                <div className="bd">
                  <span className="tiny">{p.cat} · {p.fmt}</span>
                  <b style={{ fontSize: 15, lineHeight: 1.3 }}>{p.name}</b>
                  <span className="tiny">{p.sub}</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8 }}>
                    <div className="price"><b>{lkr(p.price)}{p.per ?? ""}</b><s>{lkr(p.rrp)}</s></div>
                    <span className="add" aria-hidden="true">+</span>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head reveal"><div className="l"><span className="eyebrow">Moments that pay off</span><h2 className="h-sec">Made for the way students live.</h2></div>
          <p className="r">From the first coffee of the day to Friday night at the cinema: one pass, everywhere you go.</p></div>
        <div className="moments">
          {MOMENTS.map(([img, id, title, text], i) => (
            <a key={img} className={`moment reveal${i === 0 || i === 3 ? " tall" : ""}`} href={area(id).href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <figure><img src={`/img/${img}.jpg`} alt="" loading="lazy" decoding="async" /></figure>
              <div className="moment-cap"><b>{title}</b><span>{text}</span></div>
              <span className="moment-go" aria-hidden="true"><Icon name="i-arrow" size={16} /></span>
            </a>
          ))}
        </div>
      </section>

      <section><div className="duo"><HomeMoney /></div></section>

      <section className="sec-tight"><div className="stats-band"><HomeStats /></div></section>

      <section>
        <div className="sec-head reveal"><div className="l"><span className="eyebrow">Your next step</span><h2 className="h-sec">Wherever you are in your studies.</h2></div></div>
        <div className="paths">
          {([
            ["/preview#/pathways?start=quiz", "openday", "var(--lilac)", "i-path", "I’m exploring my options", "A short, optional aptitude check shows pathways that fit, and why.", "Start the assessment"],
            ["/preview#/pathways?start=programmes", "budget", "var(--sun)", "i-search", "I know what I want to study", "Search programmes in Sri Lanka and abroad, compare with family, apply once.", "Search programmes"],
            ["/campus", "campus", "var(--mint)", "i-cal", "I’m already studying", "Your timetable, classes, assignments and campus life, in one app.", "Open Campus Life"],
          ] as const).map(([href, img, tint, icon, title, text, go]) => (
            <a key={title} className="card path hover reveal" href={href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <figure className="path-ph"><img src={`/img/${img}.jpg`} alt="" loading="lazy" decoding="async" /></figure>
              <span className="path-ic" style={{ background: tint }}><Icon name={icon} size={22} /></span>
              <h3 className="h-card">{title}</h3><p className="muted">{text}</p>
              <div className="go"><span>{go}</span><span><Icon name="i-arrow" size={18} /></span></div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head reveal"><div className="l"><span className="eyebrow">Private by design</span><h2 className="h-sec">Your data stays yours.</h2></div></div>
        <div className="trust">
          {([
            ["i-qr", "A token, not your details", "Your QR refreshes every 30 seconds and never carries your name, institution or balances."],
            ["i-shield", "Merchants see the benefit", "Never your enrolment documents or anything they don’t need."],
            ["i-users", "Family sees what you share", "Share a shortlist or a payment request. Revoke any time."],
          ] as const).map(([icon, title, text]) => (
            <div key={title} className="card trust-c reveal"><span className="path-ic" style={{ background: "var(--lilac)" }}><Icon name={icon} size={22} /></span><h3 className="h-card">{title}</h3><p className="muted small">{text}</p></div>
          ))}
        </div>
      </section>

      <section>
        <div className="duo">
          <Link className="card partner hover reveal" href="/for-institutions">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="partner-ph"><img src="/img/office.jpg" alt="" loading="lazy" decoding="async" /></figure>
            <span className="eyebrow">For institutions</span>
            <h3 className="h-sec" style={{ fontSize: "clamp(26px,3vw,38px)" }}>One brain for your whole institution.</h3>
            <p className="muted">CRM, admissions, LMS, AI, payments and BI, white-labelled, with a Campus Life app your students open daily.</p>
            <span className="link-more">Explore the Institution OS <Icon name="i-arrow" size={16} /></span>
          </Link>
          <a className="card partner hover reveal" href={area("merchants").href}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <figure className="partner-ph"><img src="/img/pos.jpg" alt="" loading="lazy" decoding="async" /></figure>
            <span className="eyebrow">For merchants</span>
            <h3 className="h-sec" style={{ fontSize: "clamp(26px,3vw,38px)" }}>Reach every verified student.</h3>
            <p className="muted">One scan applies your offer at the till. Clear reconciliation, no rosters, no fraud.</p>
            <span className="link-more">Become a partner <Icon name="i-arrow" size={16} /></span>
          </a>
        </div>
      </section>

      <section>
        <div className="sec-head reveal"><div className="l"><span className="eyebrow">Questions</span><h2 className="h-sec">Good to know.</h2></div></div>
        <div className="faq reveal">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}<span className="pl" aria-hidden="true">+</span></summary><div className="ans-txt">{a}</div></details>
          ))}
        </div>
      </section>

      <section>
        <div className="cta-band reveal">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
            <h2 className="h-sec" style={{ fontSize: "clamp(28px,4vw,50px)" }}>Ready when you are.</h2>
            <p style={{ margin: 0, fontWeight: 500, maxWidth: 480 }}>iOS and Android apps are coming soon. Start on the web: your pass works in the browser today.</p>
          </div>
          <Link className="btn" href="/signup" style={{ background: "#1D1D1F", color: "#FFFFFF", position: "relative", zIndex: 1 }}>Get Student Pass <Icon name="i-arrow" size={18} /></Link>
        </div>
      </section>
    </div>
  );
}
