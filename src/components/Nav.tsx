"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, Logo } from "@/components/Icon";
import { api, authChanged, fetchMe, toast, type Me } from "@/lib/client";
import { AREA_GROUPS, AREAS } from "@/lib/design";

const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as "light" | "dark";
const subscribeTheme = (cb: () => void) => {
  window.addEventListener("sp:theme", cb);
  return () => window.removeEventListener("sp:theme", cb);
};

/** Site header, Products mega menu, mobile app bar and More sheet, as in the design prototype. */
export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [saved, setSaved] = useState(0);
  const [mega, setMega] = useState(false);
  const [more, setMore] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);

  const load = useCallback(() => {
    fetchMe().then((m) => {
      setMe(m);
      if (m?.user.role === "STUDENT") api<{ offers: unknown[] }>("/offers?saved=1").then((r) => setSaved(r.offers.length)).catch(() => {});
      else setSaved(0);
    }).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("sp:auth", load);
    window.addEventListener("sp:saved", load);
    return () => { window.removeEventListener("sp:auth", load); window.removeEventListener("sp:saved", load); };
  }, [load]);

  // Close menus on navigation, outside click and Escape.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setMega(false); setMore(false); }
  useEffect(() => {
    const click = (e: MouseEvent) => { if (!megaRef.current?.contains(e.target as Node)) setMega(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setMega(false); setMore(false); } };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", click); document.removeEventListener("keydown", key); };
  }, []);

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
  const portal: [string, string] | null =
    role === "MERCHANT_STAFF" ? ["/pos", "POS"] : role === "INSTITUTION_STAFF" ? ["/institution", "Portal"] : role === "ADMIN" ? ["/admin", "Admin"] : null;
  // Centre tab: the main action for this role.
  const centre: [string, string] = portal ?? ["/pass", "My Pass"];
  const cur = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <header className="nav" id="nav">
        <Link className="brand" href="/" aria-label="Student Pass home">
          <span className="brand-mark"><Logo size={16} /></span>
          <span className="brand-word">Student Pass</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link href="/" aria-current={cur("/")}>Home</Link>
          <div ref={megaRef} style={{ display: "contents" }}>
            <button type="button" className="nav-prod" aria-expanded={mega} aria-controls="mega" onClick={(e) => { e.stopPropagation(); setMega((m) => !m); }}>
              Products
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className={`mega${mega ? " on" : ""}`} id="mega" hidden={!mega}>
              <div className="mega-in">
                {AREA_GROUPS.map((g) => (
                  <div key={g} className="mega-col">
                    <span className="mega-h">{g}</span>
                    {AREAS.filter((a) => a.group === g).map((a) => (
                      <a key={a.id} className="mega-item" href={a.href} onClick={() => setMega(false)}>
                        <span className="mi-ic" style={{ background: a.tint }}><Icon name={a.icon} size={18} /></span>
                        <span><b>{a.name}</b><span className="tiny">{a.one}</span></span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Link href="/offers" aria-current={cur("/offers")}>Offers</Link>
          <Link href="/shop" aria-current={cur("/shop")}>Shop</Link>
          <Link href="/campus" aria-current={cur("/campus")}>Campus Life</Link>
          <Link href={role === "INSTITUTION_STAFF" ? "/institution" : "/for-institutions"} aria-current={cur("/institution") ?? cur("/for-institutions")}>Institutions</Link>
          {portal && portal[0] !== "/institution" && <Link href={portal[0]} aria-current={cur(portal[0])}>{portal[1]}</Link>}
        </nav>
        <div className="nav-right">
          <label className="sr" htmlFor="lang">Language</label>
          <select id="lang" className="select lang-sel" value="en" onChange={() => toast("Sinhala and Tamil are coming soon")}>
            <option value="en">EN</option><option value="si">සිං</option><option value="ta">தமிழ்</option>
          </select>
          <Link className="icon-btn" href="/offers?saved=1" aria-label={`Saved offers${saved ? ` (${saved})` : ""}`} style={{ position: "relative" }}>
            <Icon name="i-heart" size={19} />
            <span className="saved-badge" style={saved ? { transform: "scale(1)" } : undefined}>{saved}</span>
          </Link>
          <button className="icon-btn" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            <Icon name={theme === "light" ? "i-moon" : "i-sun"} size={19} />
          </button>
          {me === undefined ? null : me ? (
            <>
              <Link className="small muted nav-user" href="/account" title="Account" style={{ fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}>{me.user.name.split(" ")[0]}</Link>
              <button className="btn btn-ghost btn-sm nav-user" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" href="/login">Sign in</Link>
              <Link className="btn btn-primary btn-sm get-btn" href="/signup">Get Student Pass</Link>
            </>
          )}
        </div>
      </header>

      {/* Mobile / tablet app bar (design: Home · Offers · My Pass · Shop · More). */}
      <nav className="appbar" aria-label="App">
        <Link href="/" aria-current={cur("/")}><Icon name="i-home" size={22} /><span>Home</span></Link>
        <Link href="/offers" aria-current={cur("/offers")}><Icon name="i-gift" size={22} /><span>Offers</span></Link>
        <Link href={centre[0]} className="ab-pass" aria-current={cur(centre[0])}>
          <span className="fab"><Icon name="i-qr" size={24} /></span><span>{centre[1]}</span>
        </Link>
        <Link href="/shop" aria-current={cur("/shop")}><Icon name="i-cart" size={22} /><span>Shop</span></Link>
        <button type="button" onClick={() => setMore(true)} aria-expanded={more}><Icon name="i-grid" size={22} /><span>More</span></button>
      </nav>

      <div className={`scrim${more ? " on" : ""}`} onClick={() => setMore(false)} aria-hidden="true" />
      <div className={`sheet${more ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Everything in Student Pass" aria-hidden={!more}>
        <div className="grabber" />
        <div className="row" style={{ alignItems: "center", marginBottom: 6 }}>
          <div><h3 className="h-card" style={{ margin: 0 }}>Everything in Student Pass</h3><span className="tiny">All products and services</span></div>
          <button className="icon-btn" onClick={() => setMore(false)} aria-label="Close"><Icon name="i-x" size={18} /></button>
        </div>
        {AREA_GROUPS.map((g) => (
          <div key={g}>
            <span className="mega-h" style={{ display: "block", margin: "14px 0 8px" }}>{g}</span>
            <div className="more-grid">
              {AREAS.filter((a) => a.group === g).map((a) => (
                <a key={a.id} className="hq" href={a.href} onClick={() => setMore(false)}>
                  <span className="hq-ic" style={{ background: a.tint }}><Icon name={a.icon} size={22} /></span><span>{a.name}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
        <span className="mega-h" style={{ display: "block", margin: "14px 0 8px" }}>Account</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {me ? (
            <>
              <Link className="btn btn-ghost btn-sm" href="/account" onClick={() => setMore(false)}>Account</Link>
              {portal && <Link className="btn btn-ghost btn-sm" href={portal[0]} onClick={() => setMore(false)}>{portal[1]}</Link>}
              <button className="btn btn-ghost btn-sm" onClick={() => { setMore(false); logout(); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-primary btn-sm" href="/signup" onClick={() => setMore(false)}>Get Student Pass</Link>
              <Link className="btn btn-ghost btn-sm" href="/login" onClick={() => setMore(false)}>Sign in</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
