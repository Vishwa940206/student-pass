// Pass card designs, from the prototype's card collection. Shared by server and client.
export interface Skin {
  id: string;
  name: string;
  bg: string;
  dark?: boolean;
  mark: string; // logo colour
  s: string; // logo stroke
  ed: string; // edition label
  ring?: string;
  swatch: string;
}

export const SKINS: Skin[] = [
  { id: "graphite", name: "Classic Graphite", bg: "linear-gradient(150deg,#1D1D28,#0B0B10 65%)", dark: true, mark: "var(--mint)", s: "#111118", ed: "MEMBER", ring: "0 0 0 1.5px rgba(182,255,110,.6)", swatch: "#14141B" },
  { id: "aurora", name: "Aurora", bg: "var(--aurora)", mark: "#0B0B10", s: "var(--cyan)", ed: "MEMBER", swatch: "linear-gradient(120deg,var(--mint),var(--cyan),var(--lilac))" },
  { id: "sunset", name: "Sunset", bg: "var(--sunset)", mark: "#0B0B10", s: "var(--coral)", ed: "DROP 01", swatch: "linear-gradient(120deg,var(--sun),var(--coral),var(--pink))" },
  { id: "lilac", name: "Lilac Dream", bg: "radial-gradient(circle at 10% 0%,var(--lilac),transparent 45%),radial-gradient(circle at 100% 100%,var(--cyan),transparent 50%),var(--lilac)", mark: "#0B0B10", s: "var(--lilac)", ed: "MEMBER", swatch: "var(--lilac)" },
  { id: "mint", name: "Mint Fresh", bg: "radial-gradient(circle at 85% 110%,rgba(255,255,255,.6),transparent 45%),var(--mint)", mark: "#0B0B10", s: "var(--mint)", ed: "MEMBER", swatch: "var(--mint)" },
  { id: "black", name: "Black Edition", bg: "conic-gradient(from 210deg at 80% 120%,rgba(182,255,110,.35),rgba(92,225,255,.35),rgba(183,156,255,.35),rgba(255,138,216,.35),rgba(182,255,110,.35)),#050507", dark: true, mark: "#F5F5F7", s: "#050507", ed: "POSTGRAD", swatch: "#050507" },
  { id: "cyber", name: "Cyber Sky", bg: "repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 14px,transparent 14px 28px),var(--cyan)", mark: "#0B0B10", s: "var(--cyan)", ed: "MEMBER", swatch: "var(--cyan)" },
  { id: "fresher", name: "Freshers", bg: "radial-gradient(circle at 20% 120%,rgba(255,122,89,.65),transparent 45%),var(--sun)", mark: "#0B0B10", s: "var(--sun)", ed: "FRESHER", swatch: "var(--sun)" },
  { id: "creator", name: "Creator", bg: "radial-gradient(circle at 88% 22%,var(--sun) 0 34px,transparent 35px),radial-gradient(circle at 74% 82%,var(--lilac) 0 22px,transparent 23px),var(--pink)", mark: "#0B0B10", s: "var(--pink)", ed: "CREATOR", swatch: "var(--pink)" },
];

export const SKIN_IDS = SKINS.map((s) => s.id) as [string, ...string[]];
export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
