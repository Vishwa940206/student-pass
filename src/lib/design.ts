// Content from the design prototype (student-pass.html), shared by the site shell and home.
// Live: offers, shop, pay (fees + family link), rewards, pass, campus, jobs & housing, institutions.
// `href` points at the live page where a feature is real, otherwise at its design screen
// under /preview (the design's own router reads the #hash).

export const HERO_VIDEO = "/video/hero.mp4"; // copy of the design's hero video (originally on a third-party CDN)

export interface Area { id: string; group: "Students" | "Study & life" | "Partners"; name: string; icon: string; tint: string; one: string; href: string }

export const AREAS: Area[] = [
  { id: "offers", group: "Students", name: "Student offers", icon: "i-gift", tint: "var(--lilac)", one: "Save on food, cinema, fitness & software", href: "/offers" },
  { id: "shop", group: "Students", name: "Student Shop", icon: "i-cart", tint: "var(--sun)", one: "Books, laptops, subscriptions & merch", href: "/shop" },
  { id: "pay", group: "Students", name: "Pay", icon: "i-card", tint: "var(--lilac)", one: "Fees, top-ups, bills & subscriptions", href: "/campus?tab=fees" },
  { id: "loans", group: "Students", name: "Student loans", icon: "i-coin", tint: "var(--sun)", one: "Tuition, device & study-abroad finance", href: "/preview#/p?id=loans" },
  { id: "rewards", group: "Students", name: "Pass Points", icon: "i-star", tint: "var(--lilac)", one: "Earn on everything, unlock tiers", href: "/rewards" },
  { id: "pass", group: "Students", name: "Student Pass", icon: "i-qr", tint: "var(--mint)", one: "Your verified digital & physical pass", href: "/pass" },
  { id: "pathways", group: "Study & life", name: "Offerletter", icon: "i-path", tint: "var(--sun)", one: "Assessment, programmes & applications", href: "/preview#/p?id=pathways" },
  { id: "campus", group: "Study & life", name: "Campus Life", icon: "i-cal", tint: "var(--lilac)", one: "Timetable, classes, events & AI help", href: "/campus" },
  { id: "life", group: "Study & life", name: "Jobs, housing & more", icon: "i-brief", tint: "var(--cyan)", one: "Part-time jobs, housing, data & cover", href: "/life" },
  { id: "institutions", group: "Partners", name: "Institution OS", icon: "i-biz", tint: "var(--mint)", one: "CRM, admissions, LMS, AI, payments & BI", href: "/for-institutions" },
  { id: "merchants", group: "Partners", name: "For merchants", icon: "i-bag", tint: "var(--sun)", one: "Reach verified students at the till", href: "/preview#/p?id=merchants" },
];
export const area = (id: string) => AREAS.find((a) => a.id === id)!;
export const AREA_GROUPS = ["Students", "Study & life", "Partners"] as const;

/** Home quick actions (design order). */
export const QUICK: [label: string, icon: string, href: string, tint: string][] = [
  ["Offers", "i-gift", "/offers", "var(--lilac)"],
  ["Shop", "i-cart", "/shop", "var(--sun)"],
  ["Pay fees", "i-card", "/campus?tab=fees", "var(--lilac)"],
  ["Loans", "i-coin", "/preview#/app?t=money", "var(--sun)"],
  ["My Pass", "i-qr", "/pass", "var(--mint)"],
  ["Rewards", "i-star", "/rewards", "var(--sun)"],
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

export const lkr = (rupees: number) => "LKR " + rupees.toLocaleString("en-LK");
