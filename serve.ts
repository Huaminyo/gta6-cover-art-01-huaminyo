// Midnight Vice Cover Studio — local static server.
//
// Serves app/ over HTTP on localhost for development and screenshot
// capture. Run: `node serve.ts` (or PORT=8123 node serve.ts), then open
// http://localhost:8080 in desktop Chrome. No build step, no dependencies.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "app");
const port = Number(process.env.PORT || 8080);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const raw = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  const rel = normalize(raw).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]/, "") || "index.html";
  const file = join(appDir, rel);
  if (!file.startsWith(appDir + sep) && file !== appDir) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log(`Midnight Vice Cover Studio at http://localhost:${port}`);
});
