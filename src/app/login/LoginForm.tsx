"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, authChanged, toast } from "@/lib/client";

const HOME_FOR_ROLE = { STUDENT: "/pass", MERCHANT_STAFF: "/pos", ADMIN: "/admin" } as const;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: { name: string; role: keyof typeof HOME_FOR_ROLE } }>("/auth/login", {
        method: "POST",
        json: { email: f.get("email"), password: f.get("password") },
      });
      authChanged();
      toast(`Welcome back, ${user.name.split(" ")[0]}`);
      router.push(HOME_FOR_ROLE[user.role]);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={onSubmit} noValidate>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <span className="spinner" /> : "Sign in"}</button>
      <p className="tiny" style={{ margin: 0 }}>New here? <Link href="/signup">Get your Student Pass</Link></p>
      {process.env.NODE_ENV !== "production" && (
        <p className="tiny" style={{ margin: 0 }}>
          Dev accounts (password <b>studentpass</b>): nethmi@example.com · kasun@example.com · ishara@example.com (frozen) ·
          amaya@example.com (pending) · cashier@sandbox-cafe.example · admin@studentpass.example
        </p>
      )}
    </form>
  );
}
