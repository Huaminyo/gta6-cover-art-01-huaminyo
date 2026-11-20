// Midnight Vice Cover Studio — the gta6-cover-art-01 entrypoint (Node 22,
// standard library only). It hands the app in: it copies this repo's app/
// and screenshots/ into the output directory and writes dossier.json there
// with the kit's vendored buildDossier, the summary the judge reads.
//
// The app itself is the static files under app/: index.html plus its ES
// modules, the Anton / Pacifico / Bebas Neue fonts under the SIL Open Font
// License, and AI-made sample photos. Nothing is fetched at run time.
//
// Try it locally with `node serve.ts` (http://localhost:8080).
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function mirror(name) {
  const from = join(here, name);
  if (!existsSync(from)) return;
  const to = join(outDir, name);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
mirror('app');
mirror('screenshots');

// The scorer's caps (reference/gate.json): text_max_bytes is the only one
// that shapes the dossier's bytes; the rest refuse an entry the scorer
// would refuse — more than 4 screenshots or one over 256 KiB; more than
// 993 files under app/ or 48 MiB of app files in all; a path under app/
// longer than 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
