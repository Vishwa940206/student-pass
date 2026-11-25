import "server-only";
import { db } from "@/lib/db";

export interface Branding {
  id: string; slug: string; name: string; shortName: string;
  displayName: string; tagline: string | null; brandColor: string | null; logoUrl: string | null;
}

/** Public branding for an institution (no logo bytes; the logo has its own cached URL). */
export async function brandingOf(institutionId: string): Promise<Branding> {
  const i = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { id: true, slug: true, name: true, shortName: true, displayName: true, tagline: true, brandColor: true, logoType: true, logoUpdatedAt: true },
  });
  return {
    id: i.id, slug: i.slug, name: i.name, shortName: i.shortName,
    displayName: i.displayName ?? i.name, tagline: i.tagline, brandColor: i.brandColor,
    logoUrl: i.logoType ? `/api/v1/institutions/${i.id}/logo?v=${i.logoUpdatedAt?.getTime() ?? 0}` : null,
  };
}
