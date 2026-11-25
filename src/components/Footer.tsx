import Link from "next/link";
import { Logo } from "@/components/Icon";
import { area } from "@/lib/design";

const a = (id: string) => area(id).href;

/** Site footer, as in the design prototype. */
export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="brand" href="/"><span className="brand-mark"><Logo /></span><span className="brand-word">Student Pass</span></Link>
            <p className="muted small" style={{ margin: "12px 0 0", maxWidth: 280 }}>
              The student super app for Sri Lanka. Offers, shopping, payments, finance and campus life, with one verified pass.
            </p>
          </div>
          <div><b className="foot-h">Students</b>
            <Link href="/offers">Student offers</Link><a href={a("shop")}>Student Shop</a><a href={a("pay")}>Pay</a>
            <a href={a("loans")}>Student loans</a><a href={a("rewards")}>Pass Points</a><Link href="/pass">Student Pass</Link>
          </div>
          <div><b className="foot-h">Study &amp; life</b>
            <a href={a("pathways")}>Offerletter</a><Link href="/campus">Campus Life</Link><a href={a("life")}>Jobs, housing &amp; more</a><a href="/preview#/cards">Card designs</a>
          </div>
          <div><b className="foot-h">Partners</b>
            <Link href="/for-institutions">Institution OS</Link><Link href="/institution">Institution portal</Link>
            <a href={a("merchants")}>For merchants</a><Link href="/pos">Merchant POS</Link>
          </div>
        </div>
        <div className="foot">
          <span>© 2026 Student Pass · studentpass.lk</span>
          {process.env.NODE_ENV !== "production" && <span>Development build</span>}
        </div>
      </div>
    </footer>
  );
}
