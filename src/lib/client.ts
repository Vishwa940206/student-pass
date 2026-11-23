"use client";
// Browser-side helpers for calling the /api/v1 JSON API.

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: { ...(json !== undefined && { "content-type": "application/json" }), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiFailure(res.status, data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong", data?.error?.issues);
  }
  return data as T;
}

export interface Me {
  user: { id: string; email: string; name: string; role: "STUDENT" | "MERCHANT_STAFF" | "ADMIN" };
  student: null | {
    verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
    passState: "ACTIVE" | "FROZEN";
    institution: { shortName: string };
  };
}

/** Returns the signed-in user, or null. */
export async function fetchMe(): Promise<Me | null> {
  const me = await api<Me | { user: null }>("/me");
  return me.user ? (me as Me) : null;
}

/** Tiny event bus so any component can raise a toast or announce a sign-in change. */
export const toast = (message: string) => window.dispatchEvent(new CustomEvent("sp:toast", { detail: message }));
export const authChanged = () => window.dispatchEvent(new Event("sp:auth"));

export const formatLkr = (cents: number) =>
  "LKR " + (cents / 100).toLocaleString("en-LK", { maximumFractionDigits: 2, minimumFractionDigits: cents % 100 ? 2 : 0 });
