"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Tabs } from "@/components/Tabs";
import { api, ApiFailure, toast } from "@/lib/client";
import { fmtDate } from "@/lib/format";

interface Listing { id: string; kind: "JOB" | "HOUSING"; title: string; organisation: string; description: string; district: string; pay: string; institutionId: string | null; createdAt: string; responded: boolean }

export function LifeView() {
  const [kind, setKind] = useState<"JOB" | "HOUSING">("JOB");
  const [d, setD] = useState<{ canRespond: boolean; listings: Listing[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { api<{ canRespond: boolean; listings: Listing[] }>(`/life/listings?kind=${kind}`).then(setD).catch((e) => toast(e.message)); }, [kind]);
  useEffect(load, [load]);

  return (
    <>
      <Tabs tabs={[["JOB", "Jobs & internships"], ["HOUSING", "Student housing"]] as const} value={kind} onChange={setKind} label="Listing type" />
      {!d ? <p className="muted">Loading…</p> : d.listings.length ? (
        <div className="panel-grid">
          {d.listings.map((l) => (
            <div key={l.id} className="card panel">
              <div className="row"><span className="tag soft">{l.district}</span>{l.institutionId && <span className="tag" style={{ background: "var(--lilac)" }}>Your institution</span>}</div>
              <h3 className="h-card" style={{ margin: 0 }}>{l.title}</h3>
              <div className="small"><b>{l.organisation}</b> · {l.pay}</div>
              <p className="muted small" style={{ margin: 0, whiteSpace: "pre-line" }}>{l.description}</p>
              <span className="tiny">Posted {fmtDate(l.createdAt)}</span>
              {l.responded ? <span className="tag" style={{ background: "var(--mint)", alignSelf: "flex-start" }}>{kind === "JOB" ? "Applied" : "Enquiry sent"}</span>
                : !d.canRespond ? <Link className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} href="/login">Sign in as a verified student to {kind === "JOB" ? "apply" : "enquire"}</Link>
                : open === l.id ? (
                  <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={async (e) => {
                    e.preventDefault(); const f = new FormData(e.currentTarget);
                    try {
                      await api(`/life/listings/${l.id}/respond`, { method: "POST", json: { message: String(f.get("message") ?? "").trim(), phone: String(f.get("phone") ?? "").trim() || undefined } });
                      toast(kind === "JOB" ? "Application sent" : "Enquiry sent"); setOpen(null); load();
                    } catch (err) { const fe = err as ApiFailure; toast(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
                  }}>
                    <textarea className="input" name="message" required minLength={10} placeholder={kind === "JOB" ? "Why you’re a good fit and when you can work" : "Your questions and when you’d move in"} aria-label="Message" />
                    <input className="input" name="phone" type="tel" placeholder="Mobile (optional)" aria-label="Mobile" />
                    <span className="tiny">Your name, email and institution are shared with the poster.</span>
                    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary btn-sm">Send</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Cancel</button></div>
                  </form>
                ) : <button className="btn btn-mint btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(l.id)}>{kind === "JOB" ? "Apply" : "Enquire"}</button>}
            </div>
          ))}
        </div>
      ) : <div className="empty">No {kind === "JOB" ? "jobs" : "housing"} listed right now. Check back soon.</div>}
    </>
  );
}
