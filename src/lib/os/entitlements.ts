import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { ModuleKey } from "./modules";

/** Throws 403 unless the institution has this Institution OS module switched on. */
export async function requireModule(institutionId: string, mod: ModuleKey) {
  const i = await db.institution.findUnique({ where: { id: institutionId }, select: { modules: true } });
  if (!i?.modules.includes(mod)) {
    throw new ApiError(403, "MODULE_OFF", "This section isn’t switched on for your institution. Ask Student Pass to enable it");
  }
}
