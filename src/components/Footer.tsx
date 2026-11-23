import Link from "next/link";
import { Logo } from "@/components/Icon";

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="brand" href="/"><span className="brand-mark"><Logo /></span><span className="brand-word">Student Pass</span></Link>
            <p className="muted small" style={{ margin: "12px 0 0", maxWidth: 280 }}>
              The student platform for Sri Lanka. Offers and a verified digital pass.
            </p>
          </div>
          <div><b className="foot-h">Students</b><Link href="/offers">Student offers</Link><Link href="/pass">My Pass</Link><Link href="/signup">Get Student Pass</Link></div>
          <div><b className="foot-h">Partners</b><Link href="/pos">Merchant POS</Link><Link href="/admin">Admin</Link></div>
        </div>
        <div className="foot"><span>© 2026 Student Pass · studentpass.lk</span><span>Development build</span></div>
      </div>
    </footer>
  );
}
