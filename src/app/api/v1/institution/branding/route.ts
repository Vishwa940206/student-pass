import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { brandingOf } from "@/lib/os/branding";

export const GET = handler(async () => {
  const { institutionId } = await requireStaff();
  return json(await brandingOf(institutionId));
});

const Input = z.object({
  displayName: z.string().trim().max(80).nullish(),
  tagline: z.string().trim().max(160).nullish(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #12C16E").nullish(),
  // data:image/png;base64,… (≤ 256 KB decoded). null removes the logo.
  logo: z.string().max(400_000).nullish(),
});

const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Institution admins set the name, colour, tagline and logo shown across their portal, Campus Life and enquiry page. */
export const PATCH = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  const input = await body(req, Input);
  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName || null;
  if (input.tagline !== undefined) data.tagline = input.tagline || null;
  if (input.brandColor !== undefined) data.brandColor = input.brandColor ? input.brandColor.toUpperCase() : null;
  if (input.logo === null) Object.assign(data, { logo: null, logoType: null, logoUpdatedAt: new Date() });
  if (input.logo) {
    // SVG is refused: it can carry scripts. Raster images only.
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input.logo);
    if (!m || !(TYPES as readonly string[]).includes(m[1])) throw new ApiError(400, "LOGO_TYPE", "Upload a PNG, JPEG or WebP image");
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 256 * 1024) throw new ApiError(400, "LOGO_SIZE", "Logo must be 256 KB or smaller");
    const magic = bytes.subarray(0, 12).toString("hex");
    const ok = magic.startsWith("89504e47") || magic.startsWith("ffd8ff") || (magic.startsWith("52494646") && magic.slice(16, 24) === "57454250");
    if (!ok) throw new ApiError(400, "LOGO_TYPE", "That file isn’t a valid PNG, JPEG or WebP image");
    Object.assign(data, { logo: bytes, logoType: m[1], logoUpdatedAt: new Date() });
  }
  await db.institution.update({ where: { id: institutionId }, data });
  return json(await brandingOf(institutionId));
});
