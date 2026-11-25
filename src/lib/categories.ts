// Offer categories and their colours (browser-safe; shared by Offers and the home page).
export const CATEGORIES: [string, string][] = [
  ["Food & drink", "var(--coral)"], ["Cinema & events", "var(--pink)"], ["Fitness", "var(--mint)"],
  ["AI & productivity", "var(--cyan)"], ["Design & media", "var(--lilac)"], ["Study & work", "var(--cyan)"],
  ["Music & streaming", "var(--pink)"], ["Essentials", "var(--sun)"],
];
export const catColor = (c: string) => CATEGORIES.find(([id]) => id === c)?.[1] ?? "#B4B4C0";
