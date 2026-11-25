import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";

const DAY = 86_400_000;

interface Action { id: string; tone: "urgent" | "soon" | "info"; title: string; detail: string; count: number; tab: string; filter?: Record<string, string> }

/**
 * BI brain: headline numbers with week-on-week change, plus "next best actions" worked out
 * from live records. Only actions for the caller's role are returned.
 */
export const GET = handler(async () => {
  const { user, institutionId, staffRole } = await requireStaff();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY), twoWeeksAgo = new Date(now - 14 * DAY);
  const admissions = staffRole === "ADMIN" || staffRole === "COUNSELLOR";
  const campus = staffRole === "ADMIN" || staffRole === "LECTURER";
  const mine = staffRole === "COUNSELLOR" ? { counsellorId: user.id } : {};
  const open = { institutionId, lostAt: null, ...mine };

  const [leadsThis, leadsLast, appsThis, appsLast, enrolledThis, enrolledLast, openLeads, verified, pending] = await Promise.all([
    db.lead.count({ where: { institutionId, createdAt: { gte: weekAgo } } }),
    db.lead.count({ where: { institutionId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    db.application.count({ where: { institutionId, createdAt: { gte: weekAgo } } }),
    db.application.count({ where: { institutionId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    db.application.count({ where: { institutionId, status: "ENROLLED", statusAt: { gte: weekAgo } } }),
    db.application.count({ where: { institutionId, status: "ENROLLED", statusAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    db.lead.count({ where: { institutionId, lostAt: null, stage: { not: "ENROLLED" } } }),
    db.studentProfile.count({ where: { institutionId, verificationStatus: "VERIFIED" } }),
    db.studentProfile.count({ where: { institutionId, verificationStatus: "PENDING" } }),
  ]);

  const actions: Action[] = [];
  if (admissions) {
    const [uncontacted, unassigned, idle, review, offers] = await Promise.all([
      db.lead.count({ where: { ...open, stage: "NEW", createdAt: { lt: new Date(now - DAY) } } }),
      staffRole === "ADMIN" ? db.lead.count({ where: { institutionId, lostAt: null, counsellorId: null, stage: { not: "ENROLLED" } } }) : 0,
      db.lead.count({ where: { ...open, stage: { in: ["CONTACTED", "COUNSELLING"] }, lastActivityAt: { lt: new Date(now - 7 * DAY) } } }),
      db.application.count({ where: { institutionId, status: "UNDER_REVIEW", statusAt: { lt: new Date(now - 5 * DAY) }, ...(staffRole === "COUNSELLOR" && { lead: { counsellorId: user.id } }) } }),
      db.application.count({ where: { institutionId, status: "OFFER_ISSUED", statusAt: { lt: new Date(now - 7 * DAY) }, ...(staffRole === "COUNSELLOR" && { lead: { counsellorId: user.id } }) } }),
    ]);
    if (uncontacted) actions.push({ id: "uncontacted", tone: "urgent", count: uncontacted, title: `${uncontacted} new ${uncontacted === 1 ? "enquiry hasn’t" : "enquiries haven’t"} been contacted`, detail: "Waiting more than a day. Enquiries contacted within 24 hours convert far better.", tab: "crm", filter: { stage: "NEW" } });
    if (unassigned) actions.push({ id: "unassigned", tone: "soon", count: unassigned, title: `${unassigned} open ${unassigned === 1 ? "enquiry has" : "enquiries have"} no counsellor`, detail: "Assign them so someone owns the follow-up.", tab: "crm", filter: { counsellor: "none" } });
    if (review) actions.push({ id: "review", tone: "urgent", count: review, title: `${review} ${review === 1 ? "application has" : "applications have"} been under review for 5+ days`, detail: "Issue an offer or a decision.", tab: "admissions", filter: { status: "UNDER_REVIEW" } });
    if (offers) actions.push({ id: "offers", tone: "soon", count: offers, title: `${offers} ${offers === 1 ? "offer is" : "offers are"} waiting 7+ days for acceptance`, detail: "A reminder call usually settles it.", tab: "admissions", filter: { status: "OFFER_ISSUED" } });
    if (idle) actions.push({ id: "idle", tone: "soon", count: idle, title: `${idle} ${idle === 1 ? "lead has" : "leads have"} gone quiet for a week`, detail: "In contact or counselling, but no activity for 7 days.", tab: "crm", filter: { idleDays: "7" } });
  }
  if (staffRole === "ADMIN" && pending) {
    actions.push({ id: "verify", tone: "urgent", count: pending, title: `${pending} ${pending === 1 ? "student is" : "students are"} waiting for verification`, detail: "Their Student Pass and Campus Life stay locked until you verify them.", tab: "students" });
  }
  if (campus) {
    const courseScope = staffRole === "LECTURER" ? { lecturerId: user.id } : {};
    const due = await db.assignment.findMany({
      where: { dueAt: { lt: new Date(now) , gte: new Date(now - 60 * DAY) }, course: { institutionId, ...courseScope } },
      select: { title: true, course: { select: { code: true, _count: { select: { enrolments: true } } } }, _count: { select: { grades: true } } },
    });
    const ungraded = due.filter((a) => a._count.grades < a.course._count.enrolments);
    if (ungraded.length) {
      actions.push({ id: "grading", tone: "soon", count: ungraded.length, title: `${ungraded.length} past-due ${ungraded.length === 1 ? "assignment needs" : "assignments need"} grading`, detail: ungraded.slice(0, 3).map((a) => `${a.course.code} · ${a.title}`).join(", "), tab: "courses" });
    }
    const soon = await db.event.findMany({
      where: { institutionId, startsAt: { gte: new Date(now), lt: new Date(now + 7 * DAY) }, capacity: { not: null } },
      select: { title: true, capacity: true, _count: { select: { rsvps: true } } },
    });
    const filling = soon.filter((e) => e._count.rsvps >= 0.9 * (e.capacity ?? Infinity));
    if (filling.length) actions.push({ id: "events", tone: "info", count: filling.length, title: `${filling.length} ${filling.length === 1 ? "event is" : "events are"} almost full this week`, detail: filling.map((e) => `${e.title} (${e._count.rsvps}/${e.capacity})`).join(", "), tab: "events" });
  }

  const order = { urgent: 0, soon: 1, info: 2 };
  actions.sort((a, b) => order[a.tone] - order[b.tone] || b.count - a.count);
  return json({
    role: staffRole,
    kpis: {
      enquiries: { value: leadsThis, prev: leadsLast },
      applications: { value: appsThis, prev: appsLast },
      enrolled: { value: enrolledThis, prev: enrolledLast },
      openLeads, verified, pending,
    },
    actions,
  });
});
