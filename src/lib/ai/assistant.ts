import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * The institution assistant: answers only from knowledge the institution approved,
 * cites the entries it used, and asks for a human hand-over when it can't answer.
 *
 * Model: claude-opus-5-5 at low effort (chat), with the server-side refusal fallback on.
 * Needs ANTHROPIC_API_KEY; without it the assistant reports that it isn't configured.
 */
const MODEL = "claude-opus-5-5";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

const Reply = z.object({
  answer: z.string().describe("The reply to show the person. Plain text, short paragraphs, no markdown headings."),
  source_ids: z.array(z.string()).describe("IDs of the knowledge entries the answer relies on. Empty if none."),
  handover: z.boolean().describe("True when the question isn't covered by the knowledge, needs a person, or asks for a decision."),
});
export type AssistantReply = z.infer<typeof Reply>;

export interface KnowledgeForAI { id: string; title: string; body: string; source: string | null }
export interface Turn { role: "user" | "assistant"; content: string }

function systemPrompt(institution: string, knowledge: KnowledgeForAI[], studentContext: string | null) {
  const kb = knowledge
    .map((k) => `<entry id="${k.id}" title="${k.title.replace(/"/g, "'")}"${k.source ? ` source="${k.source.replace(/"/g, "'")}"` : ""}>\n${k.body}\n</entry>`)
    .join("\n");
  return `You are the assistant for ${institution}, answering prospective students, parents and current students.

Answer only from the approved knowledge below. If the knowledge doesn't cover the question, say you'll pass it to a counsellor and set handover to true; don't guess or use outside facts about ${institution}. Decisions (admission outcomes, scholarships awarded, visas, refunds for a specific person) always need a person: explain the general policy if it's in the knowledge, and set handover to true. List in source_ids every entry you used.

Be warm and brief: two to four sentences unless a list is clearer. Reply in the language the person writes in (English, Sinhala or Tamil).
${studentContext ? `\nThe person is a signed-in student. Their own records, which you may use to answer questions about their deadlines, grades and fees:\n<student>\n${studentContext}\n</student>\n` : "\nThe person isn't signed in. For questions about their own application, grades or fees, ask them to sign in to Campus Life or leave their contact details for a counsellor.\n"}
<knowledge>
${kb || "(No approved knowledge yet.)"}
</knowledge>`;
}

/** One assistant turn. History is the conversation so far (oldest first), ending with the new user message. */
export async function askAssistant(opts: {
  institution: string;
  knowledge: KnowledgeForAI[];
  studentContext: string | null;
  history: Turn[];
}): Promise<AssistantReply> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(Reply) },
    system: [{ type: "text", text: systemPrompt(opts.institution, opts.knowledge, opts.studentContext), cache_control: { type: "ephemeral" } }],
    messages: opts.history.map((t) => ({ role: t.role, content: t.content })),
  });

  if (response.stop_reason === "refusal") {
    return { answer: "I can’t help with that here, so I’ll pass it to a counsellor.", source_ids: [], handover: true };
  }
  const parsed = response.parsed_output;
  if (!parsed) return { answer: "Sorry, something went wrong. I’ll pass your question to a counsellor.", source_ids: [], handover: true };
  const known = new Set(opts.knowledge.map((k) => k.id));
  return { ...parsed, source_ids: parsed.source_ids.filter((id) => known.has(id)) };
}
