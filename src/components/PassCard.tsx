import type { ReactNode } from "react";
import { Icon, Logo } from "@/components/Icon";
import { skinById } from "@/lib/skins";

/** The Student Pass card, as designed in the prototype. */
export function PassCard({ skin, name, meta, middle, maxWidth }: {
  skin: string; name: string; meta: string; middle?: ReactNode; maxWidth?: number;
}) {
  const k = skinById(skin);
  return (
    <div
      className={`pass${k.dark ? " dark" : ""}`}
      style={{
        ["--skin" as string]: k.bg,
        ...(k.ring && { boxShadow: `${k.ring},0 30px 60px rgba(0,0,0,.35)` }),
        ...(maxWidth && { maxWidth }),
      }}
    >
      <div className="row">
        <span className="wm"><Logo size={20} color={k.mark} stroke={k.s} />STUDENT PASS</span>
        <span className="edition">{k.ed}</span>
      </div>
      {middle}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div><div className="name">{name}</div><div className="meta">{meta}</div></div>
        <span className="nfc"><Icon name="i-nfc" size={24} /></span>
      </div>
    </div>
  );
}
