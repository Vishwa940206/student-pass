import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { aiConfigured, askAssistant, type Turn } from "@/lib/ai/assistant";
import { brandingOf } from "@/lib/os/branding";
import { fmtDateServer } from "@/lib/os/dates";
import Anthropic from "@anthropic-ai/sdk";

const MAX_TURNS = 30; // per conversation (each turn = one question)

/** Runs one chat turn for an institution and stores both messages. */
export async function chatTurn(opts: {
  institutionId: string;
  channel: "PUBLIC" | "STUDENT";
  studentId?: string;
  conversationId?: string;
  message: string;
}) {
  if (!aiConfigured()) throw new ApiError(503, "AI_OFF", "The assistant isn’t available right now");
  const inst = await db.institution.findUniqueOrThrow({ where: { id: opts.institutionId }, select: { modules: true } });
  if (!inst.modules.includes("ai")) throw new ApiError(403, "MODULE_OFF", "The assistant isn’t switched on for this institution");

  let conversationId = opts.conversationId;
  if (conversationId) {
    const c = await db.conversation.findFirst({
      where: { id: conversationId, institutionId: opts.institutionId, channel: opts.channel, studentId: opts.studentId ?? null },
      select: { id: true, _count: { select: { messages: true } } },
    });
    if (!c) throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    if (c._count.messages >= MAX_TURNS * 2) throw new ApiError(429, "TOO_LONG", "This conversation is long. Start a new one, or ask a counsellor");
  } else {
    conversationId = (await db.conversation.create({ data: { institutionId: opts.institutionId, channel: opts.channel, studentId: opts.studentId ?? null }, select: { id: true } })).id;
  }

  const [branding, knowledge, past, studentContext] = await Promise.all([
    brandingOf(opts.institutionId),
    db.knowledgeEntry.findMany({ where: { institutionId: opts.institutionId, approved: true }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, body: true, source: true } }),
    db.chatMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, select: { role: true, content: true } }),
    opts.studentId ? studentSummary(opts.studentId) : Promise.resolve(null),
  ]);
  const history: Turn[] = [...past.map((m) => ({ role: m.role as Turn["role"], content: m.content })), { role: "user", content: opts.message }];

  let reply;
  try {
    reply = await askAssistant({ institution: branding.displayName, knowledge, studentContext, history });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ApiError(429, "BUSY", "The assistant is busy. Try again in a minute");
    if (e instanceof Anthropic.APIError) { console.error("assistant", e.status, e.message); throw new ApiError(502, "AI_ERROR", "The assistant couldn’t answer just now. Try again shortly"); }
    throw e;
  }

  await db.$transaction([
    db.chatMessage.create({ data: { conversationId, role: "user", content: opts.message, sources: [] } }),
    db.chatMessage.create({ data: { conversationId, role: "assistant", content: reply.answer, sources: reply.source_ids } }),
    db.conversation.update({
      where: { id: conversationId },
      data: { ...(reply.source_ids.length && { answered: { increment: 1 } }), ...(reply.handover && { handedOver: true }) },
    }),
  ]);
  const used = knowledge.filter((k) => reply.source_ids.includes(k.id)).map((k) => ({ id: k.id, title: k.title, source: k.source }));
  return { conversationId, answer: reply.answer, sources: used, handover: reply.handover };
}

/** What the assistant may know about a signed-in student: their own deadlines, grades, fees. */
async function studentSummary(studentId: string): Promise<string> {
  const s = await db.studentProfile.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      user: { select: { name: true } }, studentNumber: true, programme: true, validUntil: true,
      enrolments: { select: { course: { select: { code: true, name: true, assignments: { where: { dueAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, select: { title: true, dueAt: true, maxMarks: true, grades: { where: { studentId }, select: { marks: true } }, submissions: { where: { studentId }, select: { submittedAt: true } } } } } } } },
      invoices: { where: { status: "DUE" }, select: { number: true, item: true, amountCents: true, dueDate: true } },
    },
  });
  const lines = [
    `Name: ${s.user.name}; student number ${s.studentNumber}${s.programme ? `; programme ${s.programme}` : ""}${s.validUntil ? `; pass valid until ${fmtDateServer(s.validUntil)}` : ""}.`,
    ...s.enrolments.flatMap(({ course: c }) => c.assignments.map((a) =>
      `${c.code} ${c.name}: "${a.title}" due ${fmtDateServer(a.dueAt)}; ${a.grades[0] ? `graded ${a.grades[0].marks}/${a.maxMarks}` : a.submissions[0] ? "submitted, not graded yet" : "not submitted"}.`)),
    ...(s.invoices.length ? s.invoices.map((i) => `Unpaid invoice ${i.number}: ${i.item}, LKR ${(i.amountCents / 100).toLocaleString("en-LK")}, due ${fmtDateServer(i.dueDate)}.`) : ["No unpaid invoices."]),
  ];
  return lines.join("\n");
}
