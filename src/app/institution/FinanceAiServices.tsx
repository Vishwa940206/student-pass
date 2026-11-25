"use client";
import { useCallback, useEffect, useState } from "react";
import { api, formatLkr, toast } from "@/lib/client";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { SERVICE_GROUPS, serviceName, STUDENT_BANDS } from "@/lib/os/services";
import { remove, submit } from "./InstitutionView";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const STATUS_TONE: Record<string, string> = { PAID: "var(--mint)", DUE: "var(--surface-2)", OVERDUE: "var(--coral)", VOID: "var(--surface-2)" };

/* ───────────────────────── Fees ───────────────────────── */

interface Invoice {
  id: string; number: string; item: string; amountCents: number; dueDate: string; status: string; display: string; paidAt: string | null;
  student: { id: string; studentNumber: string; user: { name: string; email: string } };
  payments: { id: string; amountCents: number; method: string; status: string; reference: string | null; createdAt: string }[];
}
interface Fees { summary: { dueCents: number; dueCount: number; overdueCents: number; overdueCount: number; paidCents: number; paidCount: number }; invoices: Invoice[] }

export function FeesPanel() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Fees | null>(null);
  const load = useCallback(() => {
    api<Fees>(`/institution/invoices?status=${status}&q=${encodeURIComponent(q)}`).then(setD).catch((e) => toast(e.message));
  }, [status, q]);
  useEffect(load, [load]);

  return (
    <>
      {d && (
        <div className="kpis">
          <div className="stat"><span className="tiny">Outstanding · {d.summary.dueCount}</span><b style={{ fontSize: 22 }}>{formatLkr(d.summary.dueCents)}</b></div>
          <div className="stat" style={d.summary.overdueCount ? { background: "color-mix(in oklab, var(--coral) 25%, var(--surface))" } : undefined}><span className="tiny">Overdue · {d.summary.overdueCount}</span><b style={{ fontSize: 22 }}>{formatLkr(d.summary.overdueCents)}</b></div>
          <div className="stat"><span className="tiny">Collected · {d.summary.paidCount}</span><b style={{ fontSize: 22 }}>{formatLkr(d.summary.paidCents)}</b></div>
        </div>
      )}
      <div className="panel-grid">
        <form className="card panel" onSubmit={async (e) => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          const amount = Number(str(f, "amount").replace(/[^\d.]/g, ""));
          try {
            const r = await api<{ created: number; notFound: string[] }>("/institution/invoices", {
              method: "POST",
              json: { studentNumbers: str(f, "numbers").split(/[\s,;]+/).filter(Boolean), item: str(f, "item"), amountCents: Math.round(amount * 100), dueDate: str(f, "due") },
            });
            toast(r.notFound.length ? `Billed ${r.created}. Not found: ${r.notFound.join(", ")}` : `Billed ${r.created} ${r.created === 1 ? "student" : "students"}`);
            form.reset(); load();
          } catch (err) { toast((err as Error).message); }
        }}>
          <h3 className="h-card">Bill students</h3>
          <div className="form-grid">
            <div className="field full"><label htmlFor="f-item">What for</label><input className="input" id="f-item" name="item" required minLength={2} placeholder="Tuition instalment 2" /></div>
            <div className="field"><label htmlFor="f-amt">Amount (LKR)</label><input className="input" id="f-amt" name="amount" inputMode="decimal" required /></div>
            <div className="field"><label htmlFor="f-due">Due date</label><input className="input" id="f-due" name="due" type="date" required /></div>
            <div className="field full"><label htmlFor="f-nums">Student numbers (one per line, or comma-separated)</label><textarea className="input" id="f-nums" name="numbers" required style={{ minHeight: 80 }} /></div>
          </div>
          <button className="btn btn-primary">Create invoices</button>
        </form>
        <div className="card panel">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" style={{ maxWidth: 160 }}>
              <option value="all">All</option><option value="due">Unpaid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option>
            </select>
            <input className="input" placeholder="Search student, number or item" defaultValue={q} onKeyDown={(e) => { if (e.key === "Enter") setQ((e.target as HTMLInputElement).value); }} style={{ flex: 1 }} aria-label="Search invoices" />
          </div>
          {d?.invoices.map((i) => (
            <div key={i.id} className="list-row">
              <div>
                <b>{i.student.user.name}</b> <span className="tiny">{i.student.studentNumber}</span>
                <div className="meta">{i.number} · {i.item} · {formatLkr(i.amountCents)} · due {fmtDate(i.dueDate)}</div>
                {i.payments.filter((p) => p.status === "SUCCEEDED").map((p) => <div key={p.id} className="meta">Paid {fmtDate(p.createdAt)} · {p.method.replace("_", " ").toLowerCase()}{p.reference ? ` · ${p.reference}` : ""}</div>)}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="tag" style={{ background: STATUS_TONE[i.display] }}>{i.display === "DUE" ? "Unpaid" : i.display.charAt(0) + i.display.slice(1).toLowerCase()}</span>
                {i.status === "DUE" && <>
                  <button className="btn btn-mint btn-sm" onClick={() => {
                    const ref = window.prompt(`Record payment for ${i.number} (${formatLkr(i.amountCents)}). Receipt or bank reference:`);
                    if (ref !== null) submit(`/institution/invoices/${i.id}/payments`, { method: ref.trim() ? "BANK_TRANSFER" : "CASH", reference: ref.trim() || null }, "Payment recorded", load);
                  }}>Record payment</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(`Void ${i.number}?`)) submit(`/institution/invoices/${i.id}/void`, {}, "Invoice voided", load); }}>Void</button>
                </>}
              </div>
            </div>
          ))}
          {d && !d.invoices.length && <p className="muted small" style={{ margin: 0 }}>No invoices match.</p>}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Payments gateway (in Settings) ───────────────────────── */

interface Gateway { merchantId: string | null; hasSecret: boolean; secretReadable: boolean | null; sandbox: boolean; enabled: boolean; encryptionReady: boolean; notifyUrl: string }

export function PaymentsSettings() {
  const [g, setG] = useState<Gateway | null>(null);
  const load = useCallback(() => { api<Gateway>("/institution/payments").then(setG).catch((e) => toast(e.message)); }, []);
  useEffect(load, [load]);
  if (!g) return null;
  const live = g.merchantId && g.hasSecret && g.secretReadable !== false;
  return (
    <form className="card panel" onSubmit={async (e) => {
      e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
      const json: Record<string, unknown> = { merchantId: str(f, "mid") || null, sandbox: f.get("sandbox") === "on" };
      if (str(f, "secret")) json.secret = str(f, "secret");
      if (await submit("/institution/payments", json, "Payment settings saved", load, "PATCH")) (form.elements.namedItem("secret") as HTMLInputElement).value = "";
    }}>
      <div className="row"><h3 className="h-card">Online payments · PayHere</h3><span className="tag" style={{ background: live ? "var(--mint)" : "var(--surface-2)" }}>{live ? (g.sandbox ? "Sandbox" : "Live") : "Not set up"}</span></div>
      <p className="muted small" style={{ margin: 0 }}>Students pay invoices by card through PayHere’s hosted checkout. Card details never reach Student Pass, and an invoice is marked paid only when PayHere’s signed notification arrives.</p>
      {!g.enabled && <div className="form-error">Online payments aren’t switched on for your institution. Request it under Services.</div>}
      {!g.encryptionReady && <div className="form-error">This server has no encryption key yet, so secrets can’t be saved. Ask Student Pass to set SETTINGS_ENCRYPTION_KEY.</div>}
      {g.secretReadable === false && <div className="form-error">The saved secret can’t be read any more. Enter it again.</div>}
      <div className="field"><label htmlFor="ph-mid">Merchant ID</label><input className="input" id="ph-mid" name="mid" inputMode="numeric" defaultValue={g.merchantId ?? ""} /></div>
      <div className="field"><label htmlFor="ph-sec">Merchant secret {g.hasSecret && "(saved, leave blank to keep)"}</label><input className="input" id="ph-sec" name="secret" type="password" autoComplete="off" /></div>
      <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="sandbox" defaultChecked={g.sandbox} /> Sandbox mode (test cards, no real money)</label>
      <div className="small">In PayHere, add your domain to the app and set the notify URL to:<div className="secret" style={{ fontSize: 13, marginTop: 6 }}>{g.notifyUrl}</div></div>
      <button className="btn btn-primary" disabled={!g.encryptionReady}>Save payment settings</button>
    </form>
  );
}

/* ───────────────────────── Conversational AI ───────────────────────── */

interface Entry { id: string; title: string; body: string; source: string | null; approved: boolean; updatedAt: string }
interface AiData {
  configured: boolean;
  stats: { conversations: number; answered: number; handedOver: number; contained: number };
  entries: Entry[];
  recent: { id: string; channel: string; handedOver: boolean; updatedAt: string; lead: { id: string; name: string } | null; student: { user: { name: string } } | null; messages: { role: string; content: string; createdAt: string }[] }[];
}

export function AiPanel({ isAdmin, slug }: { isAdmin: boolean; slug: string }) {
  const [d, setD] = useState<AiData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { api<AiData>("/institution/knowledge").then(setD).catch((e) => toast(e.message)); }, []);
  useEffect(load, [load]);
  if (!d) return <p className="muted">Loading…</p>;
  return (
    <>
      {!d.configured && <div className="form-error" style={{ marginBottom: 14 }}>The assistant isn’t connected yet (Student Pass needs to add its AI key). You can prepare your knowledge now.</div>}
      <div className="kpis">
        <div className="stat"><span className="tiny">Conversations</span><b>{d.stats.conversations}</b></div>
        <div className="stat"><span className="tiny">Answered from knowledge</span><b>{d.stats.answered}</b></div>
        <div className="stat"><span className="tiny">Handed to people</span><b>{d.stats.handedOver}</b></div>
        <div className="stat"><span className="tiny">Contained</span><b>{d.stats.contained}%</b></div>
      </div>
      <div className="panel-grid">
        <div className="card panel">
          <div className="row"><h3 className="h-card">Approved knowledge</h3><a className="btn btn-ghost btn-sm" href={`/enquire/${slug}`} target="_blank" rel="noreferrer">Try it</a></div>
          <p className="muted small" style={{ margin: 0 }}>The assistant answers only from approved entries and shows which it used. Withdraw an entry and it stops using it straight away.</p>
          {d.entries.map((k) => (
            <div key={k.id} className="list-row">
              <div><b>{k.title}</b>{!k.approved && <span className="tiny"> · withdrawn</span>}<div className="meta" style={{ whiteSpace: "pre-line" }}>{k.body}</div><div className="meta">{k.source ?? "No source"} · updated {fmtDate(k.updatedAt)}</div></div>
              {isAdmin && <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => submit(`/institution/knowledge/${k.id}`, { approved: !k.approved }, k.approved ? "Withdrawn" : "Approved", load, "PATCH")}>{k.approved ? "Withdraw" : "Approve"}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(`/institution/knowledge/${k.id}`, `“${k.title}”`, load)}>Delete</button>
              </div>}
            </div>
          ))}
          {isAdmin && (
            <form style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }} onSubmit={async (e) => {
              e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
              if (await submit("/institution/knowledge", { title: str(f, "title"), body: str(f, "body"), source: str(f, "source") || null }, "Entry added", load)) form.reset();
            }}>
              <b className="small">Add knowledge</b>
              <div className="field"><label htmlFor="k-t">Topic</label><input className="input" id="k-t" name="title" required minLength={2} placeholder="Refund policy" /></div>
              <div className="field"><label htmlFor="k-b">What the assistant may say</label><textarea className="input" id="k-b" name="body" required /></div>
              <div className="field"><label htmlFor="k-s">Source (shown to people)</label><input className="input" id="k-s" name="source" placeholder="Refund policy 2026" /></div>
              <button className="btn btn-primary btn-sm">Add entry</button>
            </form>
          )}
        </div>
        <div className="card panel">
          <h3 className="h-card">Recent conversations</h3>
          {d.recent.map((c) => (
            <div key={c.id} className="list-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="lead-row" style={{ border: 0, padding: 0, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 10 }} onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span><b>{c.student?.user.name ?? c.lead?.name ?? "Website visitor"}</b><span className="meta" style={{ display: "block" }}>{c.messages.find((m) => m.role === "user")?.content.slice(0, 90) ?? "—"}</span></span>
                <span className="tag" style={{ background: c.handedOver ? "var(--sun)" : "var(--surface-2)", alignSelf: "flex-start" }}>{c.handedOver ? (c.lead ? "In CRM" : "Needs a person") : c.channel === "STUDENT" ? "Student" : "Public"}</span>
              </button>
              {open === c.id && <div className="chat-log" style={{ marginTop: 10 }}>{c.messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}</div>}
            </div>
          ))}
          {!d.recent.length && <p className="muted small" style={{ margin: 0 }}>No conversations yet.</p>}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── B2B services ───────────────────────── */

interface Proposal { id: string; items: string[]; status: string; createdAt: string; notes: string | null }

export function ServicesPanel() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [d, setD] = useState<{ requests: Proposal[]; modules: string[] } | null>(null);
  const load = useCallback(() => { api<{ requests: Proposal[]; modules: string[] }>("/institution/proposals").then(setD).catch((e) => toast(e.message)); }, []);
  useEffect(load, [load]);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>License modules and add the services that get you live and growing. Pick what you need and we’ll reply with a quote.</p>
      <div className="board" style={{ marginBottom: 16 }}>
        {SERVICE_GROUPS.map(([group, items]) => (
          <div key={group} className="board-col">
            <b className="small">{group}</b>
            {items.map(([id, name, unit]) => (
              <button key={id} type="button" className={`card board-card svc${picked.has(id) ? " on" : ""}`} onClick={() => toggle(id)} aria-pressed={picked.has(id)}>
                <b>{name}</b><span className="meta">Quoted {unit}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <form className="card panel" onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        if (!picked.size) return toast("Pick at least one service");
        if (await submit("/institution/proposals", { items: [...picked], studentsBand: str(f, "band") || undefined, notes: str(f, "notes") || undefined }, "Request sent. We’ll reply with pricing", load)) setPicked(new Set());
      }}>
        <div className="row"><h3 className="h-card">{picked.size} {picked.size === 1 ? "item" : "items"} selected</h3></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="sv-b">Students (approx.)</label><select className="select" id="sv-b" name="band" defaultValue=""><option value="">—</option>{STUDENT_BANDS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="field"><label htmlFor="sv-n">Notes</label><input className="input" id="sv-n" name="notes" maxLength={2000} /></div>
        </div>
        <button className="btn btn-primary">Request proposal</button>
      </form>
      {d && d.requests.length > 0 && (
        <div className="card panel" style={{ marginTop: 16 }}>
          <h3 className="h-card">Your requests</h3>
          {d.requests.map((r) => (
            <div key={r.id} className="list-row"><div><b>{r.items.map(serviceName).join(", ")}</b><div className="meta">{fmtDateTime(r.createdAt)}{r.notes ? ` · ${r.notes}` : ""}</div></div><span className="tag soft">{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span></div>
          ))}
        </div>
      )}
    </>
  );
}
