"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiFailure } from "@/lib/client";

interface Source { id: string; title: string; source: string | null }
interface Msg { role: "user" | "assistant"; content: string; sources?: Source[]; handover?: boolean }

/**
 * Assistant chat. `endpoint` is the chat API path; `handoverEndpoint(conversationId)` (public
 * page only) collects contact details so a counsellor can follow up.
 */
export function Chat({ endpoint, title, greeting, suggestions, handoverEndpoint }: {
  endpoint: string;
  title: string;
  greeting: string;
  suggestions: string[];
  handoverEndpoint?: (conversationId: string) => string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handover, setHandover] = useState<"ask" | "sent" | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, handover]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setBusy(true); setError(null);
    try {
      const r = await api<{ conversationId: string; answer: string; sources: Source[]; handover: boolean }>(endpoint, { method: "POST", json: { conversationId, message } });
      setConversationId(r.conversationId);
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, sources: r.sources, handover: r.handover }]);
      if (r.handover && handoverEndpoint && handover !== "sent") setHandover("ask");
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : "Couldn’t reach the assistant");
    } finally { setBusy(false); }
  }

  return (
    <div className="card panel chat">
      <div className="row"><h3 className="h-card">{title}</h3><span className="tiny">Answers from approved information · AI</span></div>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div style={{ whiteSpace: "pre-line" }}>{m.content}</div>
            {m.sources && m.sources.length > 0 && <div className="tiny" style={{ marginTop: 6 }}>Source: {m.sources.map((s) => s.source ?? s.title).join(" · ")}</div>}
          </div>
        ))}
        {busy && <div className="bubble assistant"><span className="spinner" /></div>}
        {handover === "ask" && conversationId && handoverEndpoint && (
          <form className="bubble assistant" style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={async (e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            try {
              await api(handoverEndpoint(conversationId), { method: "POST", json: { name: v("name"), phone: v("phone"), email: v("email"), consent: f.get("consent") === "on" } });
              setHandover("sent");
            } catch (err) { const fe = err as ApiFailure; setError(fe.issues ? Object.values(fe.issues).flat()[0] ?? fe.message : fe.message); }
          }}>
            <b className="small">Leave your details and a counsellor will follow up</b>
            <input className="input" name="name" placeholder="Your name" required aria-label="Your name" />
            <input className="input" name="phone" type="tel" placeholder="Mobile" aria-label="Mobile" />
            <input className="input" name="email" type="email" placeholder="Email" aria-label="Email" />
            <label className="tiny" style={{ display: "flex", gap: 6 }}><input type="checkbox" name="consent" /> I agree to be contacted about my question</label>
            <button className="btn btn-primary btn-sm">Send to a counsellor</button>
          </form>
        )}
        {handover === "sent" && <div className="bubble assistant">Thanks, a counsellor has your question and will be in touch.</div>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {msgs.length < 2 && (
        <div className="chips">{suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}</div>
      )}
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement; send(input.value); input.value = ""; }}>
        <input className="input" name="q" placeholder="Ask a question" aria-label="Ask a question" maxLength={1000} style={{ flex: 1 }} autoComplete="off" />
        <button className="btn btn-primary btn-sm" disabled={busy}>Send</button>
      </form>
    </div>
  );
}
