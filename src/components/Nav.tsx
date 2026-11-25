"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Icon, Logo } from "@/components/Icon";
import { api, authChanged, fetchMe, toast, type Me } from "@/lib/client";

const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as "light" | "dark";
const subscribeTheme = (cb: () => void) => {
  window.addEventListener("sp:theme", cb);
  return () => window.removeEventListener("sp:theme", cb);
};

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);

  const load = useCallback(() => {
    fetchMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("sp:auth", load);
    return () => window.removeEventListener("sp:auth", load);
  }, [load]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sp-theme", next); } catch {}
    window.dispatchEvent(new Event("sp:theme"));
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    authChanged();
    toast("Signed out");
    router.push("/");
  };

  const role = me?.user.role;
  const links: [string, string][] = [["/", "Home"], ["/offers", "Offers"]];
  if (!me || role === "STUDENT") links.push(["/pass", "My Pass"]);
  if (role === "MERCHANT_STAFF") links.push(["/pos", "POS"]);
  if (role === "INSTITUTION_STAFF") links.push(["/institution", "Portal"]);
  if (role === "ADMIN") links.push(["/admin", "Admin"]);
  if (role !== "INSTITUTION_STAFF") links.push(["/campus", "Campus Life"]);

  // Centre tab on mobile: the main action for this role.
  const centre: [string, string] =
    role === "MERCHANT_STAFF" ? ["/pos", "POS"] : role === "ADMIN" ? ["/admin", "Admin"]
      : role === "INSTITUTION_STAFF" ? ["/institution", "Portal"] : ["/pass", "My Pass"];

  return (
    <>
    <header className="nav" id="nav">
      <Link className="brand" href="/" aria-label="Student Pass home">
        <span className="brand-mark"><Logo /></span>
        <span className="brand-word">Student Pass</span>
      </Link>
      <nav className="nav-links" aria-label="Main">
        {links.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
            style={path === href ? { background: "var(--surface-2)" } : undefined}>
            {label}
          </Link>
        ))}
        {/* Shop is still a preview (static page, so a plain link rather than <Link>). */}
        <a href="/preview#/app?t=shop">Shop</a>
        {!me && <Link href="/institution" aria-current={path === "/institution" ? "page" : undefined}>Institutions</Link>}
      </nav>
      <div className="nav-right">
        <button className="icon-btn" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
          <Icon name={theme === "light" ? "i-moon" : "i-sun"} />
        </button>
        {me === undefined ? null : me ? (
          <>
            <Link className="small muted" href="/account" title="Account" style={{ fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}>{me.user.name.split(" ")[0]}</Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost btn-sm" href="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm get-btn" href="/signup">Get Student Pass</Link>
          </>
        )}
      </div>
    </header>

    {/* Mobile bottom tab bar (shown by the prototype CSS on small screens). */}
    <nav className="appbar" aria-label="App">
      <Link href="/" aria-current={path === "/" ? "page" : undefined}><Icon name="i-home" size={22} /><span>Home</span></Link>
      <Link href="/offers" aria-current={path === "/offers" ? "page" : undefined}><Icon name="i-gift" size={22} /><span>Offers</span></Link>
      <Link href={centre[0]} className="ab-pass" aria-current={path === centre[0] ? "page" : undefined}>
        <span className="fab"><Icon name="i-qr" size={24} /></span><span>{centre[1]}</span>
      </Link>
      {me && role === "STUDENT" ? (
        <Link href="/campus" aria-current={path === "/campus" ? "page" : undefined}><Icon name="i-book" size={22} /><span>Campus</span></Link>
      ) : me ? (
        <Link href="/account" aria-current={path === "/account" ? "page" : undefined}><Icon name="i-users" size={22} /><span>Account</span></Link>
      ) : (
        <Link href="/login" aria-current={path === "/login" ? "page" : undefined}><Icon name="i-users" size={22} /><span>Sign in</span></Link>
      )}
    </nav>
    </>
  );
}
