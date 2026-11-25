import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Serves the design preview (public/preview/index.html, built by scripts/build-preview.mjs)
 * personalised for whoever is signed in: their name replaces the sample student, and their
 * institution (as a student or staff member) replaces the sample tenant. All other data in
 * the preview stays sample data, and the page says so.
 */
let template: string | undefined;

export async function GET() {
  template ??= await readFile(join(process.cwd(), "public/preview/index.html"), "utf8");
  const me = await personalisation().catch(() => null);
  const html = me
    ? template.replace("<!--SP_ME-->", `<script>window.SP_ME=${JSON.stringify(me).replace(/</g, "\\u003c")}</script>`)
    : template;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Personalised per user: never cache in shared caches.
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function personalisation() {
  const user = await getCurrentUser();
  if (!user) return null;
  const parts = user.name.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

  const institutionId =
    (await db.studentProfile.findUnique({ where: { userId: user.id }, select: { institutionId: true } }))?.institutionId ??
    (await db.institutionStaff.findUnique({ where: { userId: user.id }, select: { institutionId: true } }))?.institutionId;
  const inst = institutionId
    ? await db.institution.findUnique({
        where: { id: institutionId },
        select: { name: true, shortName: true, slug: true },
      })
    : null;

  return {
    short,
    inst: inst && {
      name: inst.name,
      abbr: inst.shortName.slice(0, 4),
      color: "var(--lilac)",
      domain: `${inst.slug}.studentpass.lk`,
    },
  };
}
