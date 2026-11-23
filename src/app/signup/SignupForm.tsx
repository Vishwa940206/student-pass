"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { api, ApiFailure, authChanged, toast } from "@/lib/client";

interface Institution { id: string; name: string; shortName: string; district: string; type: string }

const TYPE_LABEL: Record<string, string> = {
  UGC_UNIVERSITY: "UGC university",
  PUBLIC_UNIVERSITY: "Public university",
  DEGREE_AWARDING: "Degree-awarding · Sec. 25A",
  FOREIGN_DEGREE_PROVIDER: "Foreign-degree provider",
};
const PALETTE = ["var(--mint)", "var(--cyan)", "var(--lilac)", "var(--coral)", "var(--sun)", "var(--pink)"];

export function SignupForm() {
  const router = useRouter();
  const [insts, setInsts] = useState<Institution[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Institution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ institutions: Institution[] }>("/institutions").then((r) => setInsts(r.institutions));
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return insts.filter((i) => !t || i.name.toLowerCase().includes(t) || i.shortName.toLowerCase().includes(t)).slice(0, 6);
  }, [insts, q]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pick) return setError("Choose your institution");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api("/auth/signup", {
        method: "POST",
        json: {
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          institutionId: pick.id,
          studentNumber: f.get("studentNumber"),
          programme: (f.get("programme") as string) || undefined,
        },
      });
      authChanged();
      toast("Account created. Verification is pending");
      router.push("/pass");
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "VALIDATION") {
        setError("Please check the fields below");
        setFieldErrors(err.issues ?? {});
      } else {
        setError((err as Error).message);
      }
      setBusy(false);
    }
  }

  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <form className="card verify" onSubmit={onSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="vQ">1 · Your institution</label>
        <div className="search">
          <Icon name="i-search" />
          <input className="input" id="vQ" type="search" placeholder="Search by name or acronym" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="inst-list" role="radiogroup" aria-label="Institution">
        {list.map((i) => {
          const on = pick?.id === i.id;
          return (
            <button type="button" key={i.id} className="inst" role="radio" aria-checked={on} onClick={() => setPick(i)}
              style={{ width: "100%", border: 0, borderBottom: "1px solid var(--line)", background: on ? "color-mix(in oklab,var(--mint) 18%,transparent)" : "transparent", textAlign: "left", color: "var(--text)" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span className="abbr" style={{ background: PALETTE[insts.indexOf(i) % PALETTE.length] }}>{i.shortName}</span>
                <div><div style={{ fontWeight: 700 }}>{i.name}</div><div className="tiny">{TYPE_LABEL[i.type]} · {i.district}</div></div>
              </div>
              {on && <span className="tag" style={{ background: "var(--mint)" }}>Selected</span>}
            </button>
          );
        })}
        {!list.length && <div className="inst"><span className="muted small">{insts.length ? "No institution matches that search." : "Loading…"}</span></div>}
      </div>

      <div className="field">
        <label htmlFor="studentNumber">2 · Student number</label>
        <input className="input" id="studentNumber" name="studentNumber" required placeholder="As shown on your student ID" />
        {fe("studentNumber") && <span className="tiny">{fe("studentNumber")}</span>}
      </div>
      <div className="field"><label htmlFor="programme">Programme (optional)</label><input className="input" id="programme" name="programme" placeholder="e.g. BSc Computing" /></div>

      <div className="field">
        <label htmlFor="name">3 · Your name</label>
        <input className="input" id="name" name="name" required autoComplete="name" />
        {fe("name") && <span className="tiny">{fe("name")}</span>}
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        {fe("email") && <span className="tiny">{fe("email")}</span>}
      </div>
      <div className="field">
        <label htmlFor="password">Password (8+ characters)</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        {fe("password") && <span className="tiny">{fe("password")}</span>}
      </div>

      <button className="btn btn-mint btn-block" disabled={busy || !pick}>
        {busy ? <span className="spinner" /> : pick ? `Sign up with ${pick.shortName}` : "Choose your institution"}
      </button>
      <p className="tiny" style={{ margin: 0 }}>Already have a pass? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
