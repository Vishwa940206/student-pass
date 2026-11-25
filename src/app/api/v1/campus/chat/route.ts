import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { chatTurn } from "@/lib/ai/chat";
import { limit } from "@/lib/rate-limit";

const Input = z.object({ conversationId: z.string().max(40).optional(), message: z.string().trim().min(1).max(1000) });

/** Campus Life assistant: knows the student's own deadlines, grades and fees. */
export const POST = handler(async (req) => {
  const { studentId, institutionId } = await requireCampusStudent();
  await limit("chat:student", studentId, 60, 60 * 60);
  const input = await body(req, Input);
  return json(await chatTurn({ institutionId, channel: "STUDENT", studentId, conversationId: input.conversationId, message: input.message }));
});
