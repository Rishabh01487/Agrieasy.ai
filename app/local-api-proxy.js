// Tiny CORS proxy for the PWA's cloud mode (for providers that block browser calls).
// Usage:  node local-api-proxy.js            (proxies to https://api.groq.com/openai/v1)
//         TARGET=https://api.openai.com/v1 node local-api-proxy.js
// Then in the PWA Settings set Base URL to http://127.0.0.1:8787/v1
const http = require("http");
const TARGET = process.env.TARGET || "https://api.groq.com/openai/v1";
http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.end();
  let body = "";
  req.on("data", c => body += c);
  req.on("end", async () => {
    try {
      const r = await fetch(TARGET + req.url, { method: req.method, headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" }, body: req.method === "GET" ? undefined : body });
      res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json", "Access-Control-Allow-Origin": "*" });
      r.body.pipe(res);
    } catch (e) { res.writeHead(502).end(JSON.stringify({ error: String(e) })); }
  });
}).listen(8787, () => console.log("proxy ready: http://127.0.0.1:8787/v1 -> " + TARGET));
