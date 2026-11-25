"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { PassCard } from "@/components/PassCard";
import { api, fetchMe, formatLkr, type Me } from "@/lib/client";
import { catColor } from "@/lib/categories";

function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    const load = () => fetchMe().then(setMe).catch(() => setMe(null));
    load();
    window.addEventListener("sp:auth", load);
    return () => window.removeEventListener("sp:auth", load);
  }, []);
  return me;
}

/** Hero wallet card: the signed-in student's pass, or the design's preview card. */
export function HomeWallet() {
  const me = useMe();
  const s = me?.student;
  const verified = s?.verificationStatus === "VERIFIED";
  return (
    <div className="wallet-card card">
      <PassCard
        skin={verified ? s.cardSkin ?? "graphite" : "graphite"}
        name={s ? me!.user.name : "Your name here"}
        meta={s ? (verified ? s.institution.shortName : "Waiting for verification") : "Verify to activate"}
        edition={verified ? "VERIFIED" : "PREVIEW"}
      />
      <div className="wc-stats">
        <a className="wc-stat" href="/preview#/app?t=pay"><span className="tiny">Wallet</span><b>Coming soon</b></a>
        <a className="wc-stat" href="/preview#/app?t=rewards"><span className="tiny">Pass Points</span><b>Coming soon</b></a>
      </div>
      {verified
        ? <Link className="btn btn-primary btn-block" href="/pass"><Icon name="i-qr" size={18} />Show my pass</Link>
        : <Link className="btn btn-primary btn-block" href={s ? "/pass" : "/signup"}>{s ? "Check my verification" : "Verify in under a minute"}</Link>}
    </div>
  );
}

interface Offer { id: string; title: string; category: string; badge: string; status: "LIVE" | "PROSPECT" }

/** "Deals for you": live offers from the database. */
export function HomeDeals() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  useEffect(() => { api<{ offers: Offer[] }>("/offers").then((r) => setOffers(r.offers.slice(0, 8))).catch(() => setOffers([])); }, []);
  if (!offers) return <div className="hrow"><div className="card deal" style={{ minHeight: 180 }} /></div>;
  return (
    <div className="hrow">
      {offers.map((o) => (
        <Link key={o.id} className="card deal hover" href="/offers" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="deal-art" style={{ background: catColor(o.category) }}><span>{o.badge}</span></div>
          <div className="deal-bd"><span className="tiny">{o.category}</span><b className="small">{o.title}</b><span className="tiny">{o.status === "LIVE" ? "Live now" : "Terms pending"}</span></div>
        </Link>
      ))}
    </div>
  );
}

/** Money + rewards: the student's next unpaid invoice when there is one. */
export function HomeMoney() {
  const me = useMe();
  const verified = me?.student?.verificationStatus === "VERIFIED";
  const [due, setDue] = useState<{ item: string; amountCents: number; dueDate: string; display: string } | null | undefined>(undefined);
  useEffect(() => {
    if (!verified) return;
    api<{ invoices: { item: string; amountCents: number; dueDate: string; status: string; display: string }[] }>("/campus/fees")
      .then((r) => setDue(r.invoices.find((i) => i.status === "DUE") ?? null)).catch(() => setDue(null));
  }, [verified]);
  return (
    <>
      <div className="card panel reveal">
        <span className="eyebrow">Money</span>
        {verified && due ? (
          <>
            <h3 className="h-card">{due.item} · {formatLkr(due.amountCents)}</h3>
            <span className="tiny">{due.display === "OVERDUE" ? "Overdue" : "Due"} {new Date(due.dueDate).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short" })} · {me!.student!.institution.shortName}</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}><Link className="btn btn-mint btn-sm" href="/campus?tab=fees">Pay now</Link><a className="btn btn-ghost btn-sm" href="/preview#/p?id=loans">Finance it</a></div>
          </>
        ) : verified && due === null ? (
          <><h3 className="h-card">All fees paid</h3><span className="tiny">Nothing due right now.</span></>
        ) : (
          <><h3 className="h-card">Pay fees your way</h3><span className="tiny">See and pay your institution’s invoices in Campus Life.</span>
            <div style={{ marginTop: 6 }}><Link className="btn btn-mint btn-sm" href="/campus?tab=fees">Open fees</Link></div></>
        )}
        <div className="rule" style={{ margin: "10px 0" }} />
        <span className="small muted">Student loans: apply with your verified profile, paid straight to your institution.</span>
        <a className="link-more" href="/preview#/p?id=loans">How student loans work <Icon name="i-arrow" size={16} /></a>
      </div>
      <div className="card panel reveal">
        <span className="eyebrow">Pass Points</span>
        <b className="big-num">Coming soon</b>
        <span className="tiny">Earn on purchases, payments and class streaks, then redeem for perks.</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}><a className="btn btn-ghost btn-sm" href="/preview#/p?id=rewards">How it works</a></div>
      </div>
    </>
  );
}

/** Stats band with live counts. */
export function HomeStats() {
  const [n, setN] = useState<{ offers: number; institutions: number } | null>(null);
  useEffect(() => {
    Promise.all([api<{ offers: unknown[] }>("/offers"), api<{ institutions: unknown[] }>("/institutions")])
      .then(([o, i]) => setN({ offers: o.offers.length, institutions: i.institutions.length })).catch(() => {});
  }, []);
  const S4: [string, string][] = [
    [n ? String(n.offers) : "–", "student offers to explore"],
    [n ? String(n.institutions) : "–", "institutions in the directory"],
    ["8", "Institution OS modules"],
    ["30s", "QR refresh, so no screenshots"],
  ];
  return <>{S4.map(([v, l]) => <div key={l} className="stat-big reveal"><b>{v}</b><span>{l}</span></div>)}</>;
}
