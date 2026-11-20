// Midnight Vice Cover Studio — entry program.
//
// Hands the app in: copies app/ and screenshots/ from this repository into
// the output directory and writes dossier.json there with buildDossier
// from the kit's vendor library. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output. Deterministic: the same repository always writes
// the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

mkdirSync(outDir, { recursive: true });

// Clear anything a previous run left, so the output is exactly this entry.
for (const name of ["app", "screenshots", "dossier.json"]) {
  const target = join(outDir, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

cpSync(join(repoRoot, "app"), join(outDir, "app"), { recursive: true });
cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), { recursive: true });

writeFileSync(
  join(outDir, "dossier.json"),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
