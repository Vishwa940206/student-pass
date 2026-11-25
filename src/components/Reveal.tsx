"use client";
import { useEffect } from "react";

/**
 * The design fades sections in as they scroll into view (`.reveal` → `.reveal.in`).
 * Watches the whole page, including content that renders later.
 */
export function Reveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = reduced ? null : new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io!.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    const scan = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io?.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
