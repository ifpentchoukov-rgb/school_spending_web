#!/usr/bin/env node
/**
 * Reads each ../school_spending/extractors/*.py and emits a JSON file
 * describing each extractor. Run at build time (and manually when
 * extractor docs change).
 *
 * The output JSON shape:
 *   {
 *     "nj_budget": {
 *       module: "extractors.nj_budget",
 *       state: "NJ",
 *       bucket: "nj",
 *       publisher: "...",
 *       documentType: "...",
 *       toplineDefinition: "...",
 *       sourcePortalUrl: "...",
 *       extractorName: "nj_budget",
 *       summary: "<first paragraph of module docstring>",
 *       statusKind: "adopted" | "actual",
 *     }
 *   }
 *
 * Saved to lib/extractor-docs.json (gitignored, regenerated each build).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow override via env, otherwise look for the sister Python repo
// next to school_spending_web.
const EXTRACTORS_DIR =
  process.env.SCHOOL_SPENDING_PY_DIR ??
  path.resolve(__dirname, "..", "..", "school_spending", "extractors");
const OUT_PATH = path.resolve(__dirname, "..", "lib", "extractor-docs.json");

/** Pull the leading triple-quoted docstring out of a Python file. */
function extractDocstring(text) {
  const m = text.match(/^"{3}([\s\S]*?)"{3}/m);
  return m ? m[1].trim() : "";
}

/** Pull a top-level `NAME = "..."` or `NAME = (...)` constant. */
function extractStringConstant(text, name) {
  // Match NAME = "..." or NAME = '...'
  const single = new RegExp(
    `^${name}\\s*=\\s*(?:f?["']([^"']*?)["'])`,
    "m",
  );
  const m1 = text.match(single);
  if (m1) return m1[1];

  // Match NAME = ( "..." "..." ) implicit concat strings
  const tuple = new RegExp(`^${name}\\s*=\\s*\\(([\\s\\S]*?)\\)`, "m");
  const m2 = text.match(tuple);
  if (m2) {
    const body = m2[1];
    const parts = [...body.matchAll(/["']([^"']*)["']/g)].map((p) => p[1]);
    return parts.join(" ").trim();
  }

  return null;
}

function summaryFromDocstring(doc) {
  if (!doc) return "";
  // First paragraph (up to first blank line)
  const para = doc.split(/\n\s*\n/)[0];
  return para.replace(/\s+/g, " ").trim();
}

async function main() {
  let entries;
  try {
    entries = await fs.readdir(EXTRACTORS_DIR);
  } catch (err) {
    console.warn(
      `[sync-extractor-docs] Skipping — extractors dir not found at ${EXTRACTORS_DIR}: ${err.message}`,
    );
    // Write an empty JSON so the build still succeeds.
    await fs.writeFile(OUT_PATH, "{}\n");
    return;
  }

  const out = {};
  for (const file of entries) {
    if (!file.endsWith(".py")) continue;
    if (file.startsWith("_")) continue;
    if (file === "__init__.py") continue;
    const moduleName = `extractors.${file.replace(/\.py$/, "")}`;
    const fullPath = path.join(EXTRACTORS_DIR, file);
    const text = await fs.readFile(fullPath, "utf-8");

    const doc = extractDocstring(text);
    out[file.replace(/\.py$/, "")] = {
      module: moduleName,
      sourceFile: `extractors/${file}`,
      state: extractStringConstant(text, "STATE"),
      bucket: extractStringConstant(text, "BUCKET"),
      extractorName: extractStringConstant(text, "EXTRACTOR_NAME"),
      publisher: extractStringConstant(text, "PUBLISHER"),
      documentType: extractStringConstant(text, "DOCUMENT_TYPE"),
      sourcePortalUrl: extractStringConstant(text, "SOURCE_PORTAL_URL"),
      toplineDefinition: extractStringConstant(text, "TOPLINE_DEFINITION"),
      docstring: doc,
      summary: summaryFromDocstring(doc),
    };
  }

  // Stable key order for diffable output
  const sorted = Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(sorted, null, 2) + "\n");
  console.log(
    `[sync-extractor-docs] Wrote ${Object.keys(sorted).length} extractors to ${path.relative(
      process.cwd(),
      OUT_PATH,
    )}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
