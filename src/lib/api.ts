import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth/session";
import { PosError } from "@/lib/pos/service";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

const errorBody = (code: string, message: string, extra?: object) => ({ error: { code, message, ...extra } });

/**
 * Wraps a route handler: maps known errors to JSON responses, and for mutating
 * requests requires a JSON body and a same-origin Origin header (CSRF guard
 * on top of SameSite=Lax session cookies).
 */
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(req.url).host) {
          throw new ApiError(403, "BAD_ORIGIN", "Cross-origin request blocked");
        }
        const type = req.headers.get("content-type") ?? "";
        if (req.headers.get("content-length") !== "0" && req.body && !type.includes("application/json")) {
          throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON");
        }
      }
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json(errorBody(e.code, e.message), e.status);
      if (e instanceof PosError) return json(errorBody(e.code, e.message), e.status);
      if (e instanceof AuthError) {
        return json(errorBody(e.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", e.message), e.status);
      }
      if (e instanceof z.ZodError) {
        return json(errorBody("VALIDATION", "Invalid request", { issues: z.flattenError(e).fieldErrors }), 400);
      }
      console.error(e);
      return json(errorBody("INTERNAL", "Something went wrong"), 500);
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}
