"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { HERO_VIDEO } from "@/lib/design";

/** Hero search: opens the Student Shop with the query (design behaviour). */
export function HomeSearch() {
  const router = useRouter();
  return (
    <form className="home-search" role="search" onSubmit={(e) => {
      e.preventDefault();
      const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
      router.push(`/shop${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    }}>
      <Icon name="i-search" size={20} />
      <label className="sr" htmlFor="homeQ">Search Student Pass</label>
      <input id="homeQ" name="q" type="search" placeholder="Search books, laptops, subscriptions…" autoComplete="off" />
      <button className="btn btn-primary btn-sm" type="submit">Search</button>
    </form>
  );
}

/** "Real student life" story band: photo, then the hero video once it scrolls into view. */
export function HomeStory() {
  const ref = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !ref.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVideo(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`story reveal${playing ? " vid-on" : ""}`}>
      <div className="story-media kb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/hero.jpg" alt="" decoding="async" />
        {video && <video className="story-vid" src={HERO_VIDEO} muted loop playsInline autoPlay preload="none" aria-hidden="true" tabIndex={-1} onPlaying={() => setPlaying(true)} />}
      </div>
      <div className="story-shade" aria-hidden="true" />
      <div className="story-copy">
        <span className="eyebrow" style={{ color: "#FFFFFF", opacity: 0.85 }}>Real student life</span>
        <h2 className="h-sec">More time with friends.<br />Less spent getting there.</h2>
        <a className="btn btn-mint btn-sm" href="/offers">See what you get <Icon name="i-arrow" size={16} /></a>
      </div>
      <span className="float-chip fc-a"><Icon name="i-check" size={16} />Weekly coffee · −LKR 950</span>
      <span className="float-chip fc-b"><Icon name="i-star" size={16} />+120 Pass Points</span>
      <span className="float-chip fc-c"><Icon name="i-card" size={16} />Semester fee paid</span>
    </div>
  );
}
