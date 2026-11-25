// Content from the design prototype (student-pass.html), shared by the site shell and home.
// `href` points at the live page where a feature is real, otherwise at its design screen
// under /preview (the design's own router reads the #hash).

export const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3Ja8NkRUwno8QbTrCfX6YzhC5W1/hf_20261119_201459_37c82222-e3b9-4b79-9167-a4b29912f7e6.mp4";

export interface Area { id: string; group: "Students" | "Study & life" | "Partners"; name: string; icon: string; tint: string; one: string; href: string }

export const AREAS: Area[] = [
  { id: "offers", group: "Students", name: "Student offers", icon: "i-gift", tint: "var(--lilac)", one: "Save on food, cinema, fitness & software", href: "/offers" },
  { id: "shop", group: "Students", name: "Student Shop", icon: "i-cart", tint: "var(--sun)", one: "Books, laptops, subscriptions & merch", href: "/preview#/p?id=shop" },
  { id: "pay", group: "Students", name: "Pay", icon: "i-card", tint: "var(--lilac)", one: "Fees, top-ups, bills & subscriptions", href: "/preview#/p?id=pay" },
  { id: "loans", group: "Students", name: "Student loans", icon: "i-coin", tint: "var(--sun)", one: "Tuition, device & study-abroad finance", href: "/preview#/p?id=loans" },
  { id: "rewards", group: "Students", name: "Pass Points", icon: "i-star", tint: "var(--lilac)", one: "Earn on everything, unlock tiers", href: "/preview#/p?id=rewards" },
  { id: "pass", group: "Students", name: "Student Pass", icon: "i-qr", tint: "var(--mint)", one: "Your verified digital & physical pass", href: "/pass" },
  { id: "pathways", group: "Study & life", name: "Offerletter", icon: "i-path", tint: "var(--sun)", one: "Assessment, programmes & applications", href: "/preview#/p?id=pathways" },
  { id: "campus", group: "Study & life", name: "Campus Life", icon: "i-cal", tint: "var(--lilac)", one: "Timetable, classes, events & AI help", href: "/campus" },
  { id: "life", group: "Study & life", name: "Jobs, housing & more", icon: "i-brief", tint: "var(--cyan)", one: "Part-time jobs, housing, data & cover", href: "/preview#/p?id=life" },
  { id: "institutions", group: "Partners", name: "Institution OS", icon: "i-biz", tint: "var(--mint)", one: "CRM, admissions, LMS, AI, payments & BI", href: "/for-institutions" },
  { id: "merchants", group: "Partners", name: "For merchants", icon: "i-bag", tint: "var(--sun)", one: "Reach verified students at the till", href: "/preview#/p?id=merchants" },
];
export const area = (id: string) => AREAS.find((a) => a.id === id)!;
export const AREA_GROUPS = ["Students", "Study & life", "Partners"] as const;

/** Home quick actions (design order). */
export const QUICK: [label: string, icon: string, href: string, tint: string][] = [
  ["Offers", "i-gift", "/offers", "var(--lilac)"],
  ["Shop", "i-cart", "/preview#/app?t=shop", "var(--sun)"],
  ["Pay fees", "i-card", "/campus?tab=fees", "var(--lilac)"],
  ["Loans", "i-coin", "/preview#/app?t=money", "var(--sun)"],
  ["My Pass", "i-qr", "/pass", "var(--mint)"],
  ["Rewards", "i-star", "/preview#/app?t=rewards", "var(--sun)"],
  ["Campus", "i-cal", "/campus", "var(--lilac)"],
  ["Pathways", "i-path", "/preview#/pathways", "var(--cyan)"],
];

export const GAINS: [areaId: string, title: string, text: string][] = [
  ["offers", "Save every day", "Student prices at cafés, cinemas, gyms and on software."],
  ["shop", "Shop for less", "Course texts, laptops and subscriptions at student prices."],
  ["pay", "Pay fees your way", "Wallet, card, a parent’s link or a tuition loan."],
  ["loans", "Borrow responsibly", "Compare student loans with your verified profile."],
  ["rewards", "Earn Pass Points", "On every purchase, payment and class streak."],
  ["campus", "Run your day", "Classes, deadlines, events and an assistant."],
];

export const MOMENTS: [img: string, areaId: string, title: string, text: string][] = [
  ["scan", "offers", "Scan at the café", "Your weekly coffee, applied in one tap."],
  ["unbox", "shop", "Laptop day, sorted", "Student price, paid in instalments."],
  ["family", "pay", "Amma pays the link", "Share a fee request with family."],
  ["cinema", "rewards", "Friday film on points", "Earn on everything, redeem for nights out."],
  ["campus", "campus", "Your day, planned", "Classes, deadlines and events in one place."],
  ["job", "life", "Shifts that fit", "Part-time work near campus."],
];

export const FAQ: [q: string, a: string][] = [
  ["Who can join?", "Currently enrolled undergraduate and postgraduate students at eligible Sri Lankan institutions, including part-time and online students. Pathways and applications are open to prospective students too. School students aren’t eligible for loyalty yet."],
  // "Does it cost anything?" is left out until the membership price is decided (design: [MEMBERSHIP PRICE]).
  ["What do merchants see when I scan?", "Only what’s needed to give you the benefit: never your enrolment documents, institution records or other personal data."],
  ["Is my QR safe to screenshot?", "The app QR refreshes every 30 seconds and carries only a short-lived token, so an old screenshot won’t work."],
  ["I lost my phone. What now?", "Freeze your pass instantly in My Pass. Scans are declined until you unfreeze it."],
  ["Can my parents see my applications?", "Only what you choose to share. You can revoke access at any time."],
];

/** Featured Student Shop items (design catalogue; the shop opens the design screen). */
const SHOP_COLORS: Record<string, string> = {
  Books: "var(--lilac)", "Software & subscriptions": "var(--mint)", "Laptops & tech": "var(--coral)",
  "Food & drinks": "var(--coral)", "Fashion & merch": "var(--cyan)",
};
export interface Product { id: string; cat: string; big: string; name: string; sub: string; price: number; rrp: number; fmt: string; per?: string; tag?: string; color: string }
const P = (id: string, cat: string, big: string, name: string, sub: string, price: number, rrp: number, fmt: string, extra: Partial<Product> = {}): Product =>
  ({ id, cat, big, name, sub, price, rrp, fmt, color: SHOP_COLORS[cat] ?? "var(--sun)", ...extra });
export const FEATURED: Product[] = [
  P("b1", "Books", "CS", "Programming Foundations — course text", "Set text for CS101 · paperback", 6900, 8400, "Physical", { tag: "Your course" }),
  P("b2", "Books", "Web", "Web Development: A Practical Guide", "Recommended for CS110", 5400, 6200, "Physical", { tag: "Your course" }),
  P("s1", "Software & subscriptions", "AI", "AI study assistant — student plan", "Monthly · cancel any time", 1490, 2990, "Subscription", { per: "/mo", tag: "Popular" }),
  P("t1", "Laptops & tech", "14\"", "Student laptop 14\" · 16 GB / 512 GB", "Pay in instalments available", 189000, 219000, "Physical", { tag: "Instalments" }),
  P("f6", "Food & drinks", "10×", "Campus café meal plan · 10 meals", "Digital voucher · valid 60 days", 4500, 5500, "Digital", { tag: "Campus" }),
  P("m1", "Fashion & merch", "SP", "Student Pass hoodie", "Heavyweight · graphite + green", 5900, 6900, "Physical", { tag: "New" }),
  P("s3", "Software & subscriptions", "♪", "Music streaming — student", "Monthly · where available", 590, 990, "Subscription", { per: "/mo" }),
  P("t2", "Laptops & tech", "Buds", "Wireless earbuds with noise cancelling", "1-year warranty", 12900, 16500, "Physical"),
];

export const lkr = (rupees: number) => "LKR " + rupees.toLocaleString("en-LK");
