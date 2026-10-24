// Local static server for testing the PWA:  node dev/serve.js [port]
// PWA/service worker need http:// (not file://) — open http://127.0.0.1:8080
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "app");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const port = Number(process.argv[2]) || 8080;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`Agrieasy.ai dev server -> http://127.0.0.1:${port}`));
