#!/usr/bin/env node
/*
 * Builds the public "Preview" from the single-file design prototype.
 *
 *   node scripts/build-preview.mjs ~/Downloads/student-pass.html
 *
 * Writes public/preview/index.html, served at /preview. Everything in it runs in the
 * browser with sample data: no accounts, no database, no network calls.
 *
 * Because the preview is public, real companies must not appear as partners until
 * there's an agreement. This script swaps them for neutral names (the same approach
 * as the live app, which uses the fictional "Sandbox Café") and fails loudly if a
 * known brand slips through or a replacement no longer matches the prototype.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/build-preview.mjs <path-to-prototype.html>");
  process.exit(1);
}
const out = resolve(import.meta.dirname, "../public/preview/index.html");
let html = readFileSync(src, "utf8");

/** Apply a replacement and insist it matched, so prototype edits can't silently skip one. */
function swap(pattern, replacement, label) {
  const before = html;
  html = html.replace(pattern, replacement);
  if (html === before) throw new Error(`Replacement didn't match anything: ${label}`);
}

// ── Real brands → neutral names ──────────────────────────────────────────────
// Barista (café chain): offer, POS, co-brand card → the fictional Sandbox Café.
swap(/\bBarista\b/g, "Sandbox Café", "Barista");
// APIIT co-brand pass card (APIIT stays in the institution list, which is factual).
swap(/name: 'APIIT', note:/g, "name: 'Partner campus', note:", "APIIT card name");
swap(/partner: 'APIIT'/g, "partner: 'Partner campus'", "APIIT card partner");
// Named software programmes: the generic "AI study tools" / "Design & video apps" entries cover them.
for (const id of ["adobe", "github", "m365"]) {
  swap(new RegExp(`\\{ id: '${id}',[^{}]*\\},?\\s*`), "", `offer ${id}`);
}
swap("Search coffee, Adobe, gyms…", "Search coffee, cinema, gyms…", "search placeholder");

const leftovers = ["Barista", "Adobe", "GitHub", "Microsoft", "'APIIT', note"].filter((b) => html.includes(b));
if (leftovers.length) throw new Error(`Brand names still present: ${leftovers.join(", ")}`);

// ── Personalisation ─────────────────────────────────────────────────────────
// src/app/preview/route.ts replaces <!--SP_ME--> with the signed-in person's name and
// institution. The sample student "Nethmi P." and the sample tenant ("Inspire College")
// become variables, so a signed-in visitor sees their own name and institution.
// Signed out (or opening /preview/index.html directly) keeps the sample data.
swap(/id="fsName">Nethmi P\.<\/span>/, 'id="fsName"></span>', "full-screen name");
swap(/'Nethmi P\.'/g, "SP_NAME", "sample name literal");
swap(/Nethmi P\./g, "' + SP_NAME + '", "sample name in strings");
swap(/Nethmi/g, "' + SP_FIRST + '", "sample first name");
swap(
  /(TEN = \{\s*ic: \{ id: 'ic', )name: 'Inspire College', abbr: 'IC', color: 'var\(--lilac\)', domain: 'campus\.inspirecollege\.example'/,
  "$1name: SP_INST.name, abbr: SP_INST.abbr, color: SP_INST.color, domain: SP_INST.domain",
  "tenant",
);
swap(
  "(SU.tenant === 'ic' ? ' selected' : '') + '>Inspire College</option>",
  "(SU.tenant === 'ic' ? ' selected' : '') + '>' + SP_INST.name + '</option>",
  "tenant picker label",
);
if (/Nethmi/.test(html)) throw new Error("Sample name still present");
swap(
  /<head>/,
  `<head>
<!--SP_ME-->
<script>
var SP_ME = window.SP_ME || null;
var SP_NAME = SP_ME ? SP_ME.short : 'Nethmi P.';
var SP_FIRST = SP_NAME.split(' ')[0];
var SP_INST = SP_ME && SP_ME.inst ? SP_ME.inst : { name: 'Inspire College', abbr: 'IC', color: 'var(--lilac)', domain: 'campus.inspirecollege.example' };
</script>`,
  "head",
);

// ── Preview framing ─────────────────────────────────────────────────────────
swap(/<title>([^<]*)<\/title>/, "<title>Preview · $1</title>", "title");
swap(
  "</head>",
  `<meta name="robots" content="noindex, nofollow">
<style>
.sp-preview{position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom));
  display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;border-radius:999px;background:#1D1D1F;color:#F5F5F7;
  font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);
  white-space:nowrap;max-width:calc(100% - 24px)}
.sp-preview b{color:#3EE08F;font-weight:700}
.sp-preview span{overflow:hidden;text-overflow:ellipsis}
.sp-preview a{padding:7px 12px;border-radius:999px;background:#3EE08F;color:#0B0B10;text-decoration:none;font-weight:700;flex-shrink:0}
@media (max-width:1024px){.sp-preview{bottom:calc(96px + env(safe-area-inset-bottom));font-size:12px}}
</style>
</head>`,
  "head",
);
swap(
  /<\/body>\s*<\/html>\s*$/,
  `<div class="sp-preview" role="note"><b>Preview</b><span>Sample data</span><a href="/">Open the live app</a></div>
</body>
</html>
`,
  "body",
);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Preview written: ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
