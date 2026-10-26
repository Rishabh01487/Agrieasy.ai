// Agrieasy.ai — Saathi app: voice in/out, retrieval, WebLLM on-device, cloud API
window.App = (function () {
  const $ = s => document.querySelector(s);
  const kb = window.KB;
  const LS = "agrieasy.settings.v2";
  const settings = Object.assign(
    { mode: "auto", apiBase: "https://api.groq.com/openai/v1", apiKey: "", apiModel: "",
      webllmModel: "AgriEasy-Saathi-v1-q4f16_1", vlang: "auto", tts: false, autosend: true },
    JSON.parse(localStorage.getItem(LS) || "{}"));
  const save = () => localStorage.setItem(LS, JSON.stringify(settings));
  if (settings.webllmModel === "Qwen2.5-1.5B-Instruct-q4f16_1-MLC") settings.webllmModel = "AgriEasy-Saathi-v1-q4f16_1"; // migrate older installs

  let engine = null, engineModel = null, history = [];

  // ---------- AgriEasy agent actions (deep-link layer; confirm-first) ----------
  // Routes into agrieasy.site role-based flows. If your team adds direct deep routes
  // (e.g. /sell/new?crop=…), just update these URLs — no other change needed.
  const ACTIONS = {
    sell:      { url: "https://agrieasy.site/auth/login?role=farmer",      label: "Open Agrieasy to publish this listing" },
    transport: { url: "https://agrieasy.site/auth/login?role=transporter", label: "Open Agrieasy transport booking" },
    buyer:     { url: "https://agrieasy.site/auth/login?role=buyer",       label: "Open Agrieasy buyer sourcing" },
    ledger:    { url: "https://agrieasy.site/ledger",                      label: "Open Ledger (bills & earnings)" },
    bill:      { url: "https://agrieasy.site/ledger/bill-calculator",      label: "Open Bill Calculator" },
    pay:       { url: "https://agrieasy.site/agripay",                     label: "Open EasyPay" }
  };
  function detectAction(q) {
    const s = q.toLowerCase();
    const crop = kb.crops.find(c => s.includes(c.hi.toLowerCase()) || s.includes(c.name.toLowerCase()) || (c.hi.split("/").some(h => s.includes(h.toLowerCase().trim()))));
    const qty = (s.match(/(\d+(?:\.\d+)?)\s*(q\b|quintal|quintals|kuintal|man\b|kg|ton)/i) || [])[1];
    const unit = (s.match(/(\d+(?:\.\d+)?)\s*(q\b|quintal|quintals|kuintal|man\b|kg|ton)/i) || [])[2];
    if (/(transport|truck|gadi|gaadi|thekra|booking|book|bhejna|delivery|levi)/.test(s)) return { type: "transport", crop, qty, unit };
    if (/(bech|bechna|sell|listing|list|bikri|kharididar dhoondh|buyer dhoondh|source)/.test(s)) return { type: "sell", crop, qty, unit };
    if (/(bill calculator|bill|hisab|ledger|earning|kamai ka record)/.test(s)) return { type: "bill", crop, qty, unit };
    if (/(easypay|payment|upi|paisa mila|paise)/.test(s)) return { type: "pay", crop, qty, unit };
    return null;
  }
  function actionCard(act) {
    const det = [];
    if (act.crop) det.push(act.crop.name);
    if (act.qty) det.push(act.qty + " " + (act.unit || "q"));
    const what = act.type === "transport" ? "Transport booking" : act.type === "pay" ? "Payment" : act.type === "bill" ? "Bill/Ledger" : "Produce listing";
    return `<div class="act"><div class="act-t">${what}${det.length ? " · " + det.join(" · ") : ""}</div><a class="act-b" href="${ACTIONS[act.type].url}" target="_blank" rel="noopener">${ACTIONS[act.type].label} &rarr;</a><div class="act-n">Review everything on Agrieasy before confirming — you stay in control.</div></div>`;
  }

  // ---------- retrieval ----------
  const STOP = new Set("ka ke ki ko kaun kya kaise kab kahan mera meri hai hain se par pe me mein a an the of in on for to how what when where why is are do does my i want need should best".split(" "));
  const toks = q => q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  function score(q, hay) {
    const T = toks(q); if (!T.length) return 0;
    const H = " " + hay.toLowerCase() + " ";
    let s = 0; T.forEach(t => { if (H.includes(t)) s += 1; });
    return s / T.length;
  }
  function retrieve(q) {
    const docs = [];
    kb.crops.forEach(c => docs.push({ type: "crop", ref: c, s: Math.max(score(q, c.name + " " + c.hi) * 2.2, score(q, Object.values(c).filter(v => typeof v === "string").join(" "))) }));
    kb.topics.forEach(t => docs.push({ type: "topic", ref: t, s: score(q, t.title + " " + t.keys.join(" ") + " " + t.text) * 1.15 }));
    return docs.sort((a, b) => b.s - a.s).filter(d => d.s > 0.24).slice(0, 2);
  }
  function contextBlock(q) {
    const hits = retrieve(q);
    if (!hits.length) return "";
    return hits.map(h => {
      if (h.type === "crop") { const c = h.ref;
        return `### ${c.name} (${c.hi}) guide\nSeason/sowing: ${c.season}; window ${c.sowWindow}. Seed: ${c.seedRate}, spacing ${c.spacing}. Fertilizer: ${c.fertilizer}. Irrigation: ${c.irrigation}. Pests: ${c.pests}. Diseases: ${c.diseases}. Harvest: ${c.harvest}. Yield: ${c.yieldAvg}-${c.yieldGood} q/acre. Post-harvest: ${c.postharvest}. Marketing: ${c.marketing}`;
      }
      return `### ${h.ref.title}\n${h.ref.text}`;
    }).join("\n\n");
  }
  function offlineAnswer(q) {
    const hits = retrieve(q);
    if (!hits.length) return "I did not find that in my built-in notes. Try a crop name (wheat, paddy, cotton, onion, tomato…), a pest, or ask about selling on AgriEasy. For sharper answers, add a free API key in Settings — or just speak your question with the mic.";
    let out = hits.map(h => {
      if (h.type === "crop") { const c = h.ref;
        return `**${c.name} (${c.hi}) — quick guide** (full dated plan in the **Plan** tab)\n` +
          `- **Sow:** ${c.sowWindow} · **Seed:** ${c.seedRate} · **Spacing:** ${c.spacing}\n` +
          `- **Fertilizer:** ${c.fertilizer}\n- **Irrigation:** ${c.irrigation}\n` +
          `- **Pests:** ${c.pests}\n- **Diseases:** ${c.diseases}\n` +
          `- **Harvest:** ${c.harvest} · **Yield:** ${c.yieldAvg}–${c.yieldGood} q/acre\n` +
          `- **Sell:** ${c.marketing}`;
      }
      return `**${h.ref.title}**\n${h.ref.text}`;
    }).join("\n\n---\n\n");
    out += `\n\n*Built-in notes — confirm with KVK; live prices in the app.*`;
    return out;
  }

  // ---------- markdown-lite ----------
  function md(t) {
    let h = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
    h = h.replace(/^### (.*)$/gm, "<h4>$1</h4>").replace(/^## (.*)$/gm, "<h3>$1</h3>").replace(/^# (.*)$/gm, "<h3>$1</h3>");
    h = h.replace(/^- (.*)$/gm, "• $1");
    h = h.replace(/^---+$/gm, "<hr>");
    return h.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  }

  // ---------- voice ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, finalText = "";
  const detectLang = () => {
    if (settings.vlang !== "auto") return settings.vlang;
    return /[\u0900-\u097F]/.test($("#inp").value || "") ? "hi-IN" : "en-IN";
  };
  function toggleMic() {
    if (!SR) { toastBubble("This browser does not support speech input. Chrome/Edge on Android works best."); return; }
    if (listening) { try { rec.stop(); } catch (e) {} return; }
    rec = new SR();
    rec.lang = detectLang(); rec.interimResults = true; rec.continuous = false;
    finalText = "";
    rec.onresult = e => {
      let interim = "";
      for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
      $("#inp").value = finalText || interim;
    };
    rec.onend = () => {
      listening = false; $("#mic").classList.remove("listening"); $("#inp").classList.remove("listening");
      if (finalText.trim() && settings.autosend) send();
    };
    rec.onerror = e => {
      listening = false; $("#mic").classList.remove("listening"); $("#inp").classList.remove("listening");
      if (e.error === "not-allowed") toastBubble("Mic permission needed — allow microphone access in the browser.");
    };
    try { rec.start(); listening = true; $("#mic").classList.add("listening"); $("#inp").classList.add("listening"); $("#inp").placeholder = "Suno raha hoon… boliye"; }
    catch (e) {}
  }
  function speakOutLoud(text) {
    if (!settings.tts || !("speechSynthesis" in window)) return;
    const clean = text.replace(/[*#|>_`•]/g, "").replace(/\n+/g, ". ").slice(0, 600);
    const u = new SpeechSynthesisUtterance(clean);
    const hasDevanagari = /[\u0900-\u097F]/.test(clean);
    u.lang = hasDevanagari ? "hi-IN" : (settings.vlang === "auto" ? "en-IN" : settings.vlang);
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.replace("_", "-").startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.rate = 0.98; u.pitch = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function toastBubble(txt) {
    const b = bubble("assistant", md("ℹ️ " + txt)); b.classList.add("err");
  }

  // ---------- modes ----------
  const hasWebGPU = () => "gpu" in navigator;
  async function ensureEngine(onProgress) {
    if (engine && engineModel === settings.webllmModel) return engine;
    if (!hasWebGPU()) throw new Error("No WebGPU on this device/browser — use cloud or built-in notes mode (Chrome/Edge 113+, Android 12+).");
    const m = await import("https://esm.run/@mlc-ai/web-llm");
    // register our fine-tuned build using the stock Qwen architecture library (same arch, different weights)
    try {
      const stock = m.prebuiltAppConfig.modelList.find(x => x.model_id === "Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
      if (stock && !m.prebuiltAppConfig.modelList.some(x => x.model_id === "AgriEasy-Saathi-v1-q4f16_1")) {
        m.prebuiltAppConfig.modelList.push({
          model: "https://huggingface.co/Rishabhthe1/agrieasy-ai-v1-q4f16_1-MLC/resolve/main/",
          model_id: "AgriEasy-Saathi-v1-q4f16_1",
          model_lib: stock.model_lib,
          vram_required_MB: stock.vram_required_MB || 1100,
          low_resource_required: true
        });
      }
    } catch (e) {}
    engine = await m.CreateMLCEngine(settings.webllmModel, { initProgressCallback: p => onProgress && onProgress(p.text, (p.progress || 0) * 100) });
    engineModel = settings.webllmModel;
    return engine;
  }
  async function askWebLLM(q, onDelta, onProgress) {
    const e = await ensureEngine(onProgress);
    const msgs = [{ role: "system", content: systemPrompt(q) }].concat(history.slice(-8), [{ role: "user", content: q }]);
    const chunks = await e.chat.completions.create({ messages: msgs, temperature: 0.4, max_tokens: 700, stream: true });
    let full = "";
    for await (const c of chunks) { const d = c.choices[0]?.delta?.content || ""; full += d; onDelta(d, full); }
    return full;
  }
  async function askCloud(q, onDelta) {
    if (!settings.apiKey) throw new Error("Cloud booster is optional and off by default — the app answers via the AgriEasy engine.");
    if (!settings.apiModel) throw new Error("Pick a model name in Settings to use the optional booster (the app works fully without it).");
    const r = await fetch(settings.apiBase.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.apiKey },
      body: JSON.stringify({ model: settings.apiModel, temperature: 0.4, max_tokens: 900, stream: true,
        messages: [{ role: "system", content: systemPrompt(q) }].concat(history.slice(-8), [{ role: "user", content: q }]) })});
    if (!r.ok) throw new Error("API error " + r.status + " — check key/base URL (if CORS-blocked, run app/local-api-proxy.js and set base to http://127.0.0.1:8787/v1).");
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "", full = "";
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) { if (!l.startsWith("data: ") || l.includes("[DONE]")) continue;
        try { const j = JSON.parse(l.slice(6)); const d = j.choices[0]?.delta?.content || ""; full += d; onDelta(d, full); } catch (e) {} } }
    return full;
  }
  function systemPrompt(q) {
    const ctx = contextBlock(q);
    return kb.SYS + (ctx ? "\n\n--- KNOWLEDGE BASE (use when relevant; quantities are indicative per-acre for India):\n" + ctx : "");
  }
  function pickMode() {
    if (settings.mode !== "auto") return settings.mode;
    if (settings.apiKey && navigator.onLine) return "cloud";
    if (engine) return "webllm";
    return "offline";
  }

  // ---------- UI ----------
  function bubble(role, html) {
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = html;
    $("#msgs").appendChild(d); $("#msgs").scrollTop = 1e9;
    return d;
  }
  async function send() {
    const q = $("#inp").value.trim(); if (!q) return;
    $("#inp").value = ""; $("#inp").placeholder = "Likhein ya mic daba kar boliye…";
    bubble("user", md(q));
    const mode = pickMode();
    const b = bubble("assistant", mode === "webllm" && !engine ? "Loading on-device model… (first time downloads ≈1 GB)" : "…");
    try {
      let out = "";
      if (mode === "offline") { await new Promise(r => setTimeout(r, 150)); out = offlineAnswer(q); b.innerHTML = md(out); }
      else if (mode === "webllm") { out = await askWebLLM(q, (d, full) => b.innerHTML = md(full), (t, pc) => b.innerHTML = md(t + (pc ? ` ${pc.toFixed(0)}%` : ""))); b.innerHTML = md(out || "(no reply)"); }
      else { out = await askCloud(q, (d, full) => b.innerHTML = md(full)); b.innerHTML = md(out || "(no reply)"); }
      history.push({ role: "user", content: q }, { role: "assistant", content: out });
      b.insertAdjacentHTML("beforeend", `<div class="tag">${mode === "offline" ? "AgriEasy notes" : mode === "webllm" ? "in-app AI model" : "cloud booster"}</div>`);
      const act = detectAction(q);
      if (act) b.insertAdjacentHTML("beforeend", actionCard(act));
      speakOutLoud(out);
    } catch (e) {
      b.className = "msg assistant err"; b.innerHTML = md("⚠️ " + e.message);
      bubble("assistant", md(offlineAnswer(q)));
    }
    badge();
  }
  const badge = () => { $("#mode-badge").textContent = "Saathi · " + ({ offline: "AgriEasy notes", webllm: engine ? "in-app AI model ✓" : "in-app AI model (not downloaded)", cloud: "cloud booster" })[pickMode()]; };

  function loadSettingsUI() {
    $("#set-mode").value = settings.mode; $("#set-base").value = settings.apiBase;
    $("#set-key").value = settings.apiKey; $("#set-model").value = settings.apiModel;
    $("#set-wllm").value = settings.webllmModel;
    $("#set-vlang").value = settings.vlang; $("#set-tts").checked = settings.tts; $("#set-autosend").checked = settings.autosend;
    $("#tts").classList.toggle("on", settings.tts);
    $("#gpu-note").textContent = hasWebGPU() ? "This device supports the in-app AI model." : "This browser can't run the in-app model — AgriEasy notes still answer everything.";
  }
  function bindUI() {
    $("#send").onclick = send;
    $("#inp").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    $("#mic").onclick = toggleMic;
    $("#tts").onclick = () => { settings.tts = !settings.tts; save(); $("#tts").classList.toggle("on", settings.tts); if (!settings.tts) speechSynthesis.cancel(); };
    document.querySelectorAll(".seeds button").forEach(c => c.onclick = () => { $("#inp").value = c.dataset.q; send(); });
    document.querySelectorAll("nav.bottom button").forEach(b => b.onclick = () => {
      document.querySelectorAll("nav.bottom button, .view").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); $("#" + b.dataset.v).classList.add("on");
      if (b.dataset.v === "view-set") loadSettingsUI();
    });
    $("#save").onclick = () => {
      settings.mode = $("#set-mode").value; settings.apiBase = $("#set-base").value.trim();
      settings.apiKey = $("#set-key").value.trim(); settings.apiModel = $("#set-model").value.trim();
      settings.webllmModel = $("#set-wllm").value.trim() || "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
      settings.vlang = $("#set-vlang").value; settings.tts = $("#set-tts").checked; settings.autosend = $("#set-autosend").checked;
      save(); $("#tts").classList.toggle("on", settings.tts);
      $("#save").textContent = "Saved ✓"; setTimeout(() => $("#save").textContent = "Save settings", 1200);
      badge();
    };
    $("#dl-model").onclick = async () => {
      const b = $("#dl-model"); b.disabled = true; b.textContent = "Downloading… (≈1 GB, one time)";
      try { await ensureEngine((t, pc) => b.textContent = (t || "loading") + (pc ? ` ${pc.toFixed(0)}%` : "")); b.textContent = "Model ready — on-device AI active"; badge(); }
      catch (e) { b.textContent = "Failed: " + e.message; }
      b.disabled = false;
    };
    // plan
    const sel = $("#p-crop"); kb.crops.forEach(c => sel.insertAdjacentHTML("beforeend", `<option value="${c.id}">${c.name} · ${c.hi}</option>`));
    const month = new Date().getMonth() + 1;
    sel.value = (month >= 9 || month <= 2) ? "wheat" : "paddy";
    $("#p-date").valueAsDate = new Date();
    $("#p-gen").onclick = () => {
      const plan = window.PlanGen.generatePlan({ cropId: sel.value, acres: $("#p-acres").value, sowDate: $("#p-date").value, district: $("#p-dist").value.trim() });
      $("#plan-out").innerHTML = `<div class="doc">${md(plan)}</div>`;
      if (settings.tts) speakOutLoud("Aapka plan taiyaar hai. Screen par dekhein.");
    };
    $("#p-print").onclick = () => window.print();
    // install
    let ip; window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); ip = e; $("#install").style.display = "inline-block"; });
    $("#install").onclick = async () => { if (!ip) return; ip.prompt(); ip = null; $("#install").style.display = "none"; };
    if ("speechSynthesis" in window) speechSynthesis.getVoices(); // warm the voice list
    badge();
    bubble("assistant", md("Namaste. Main **AgriEasy Saathi** hoon — aapke khet ka saathi.\n\nMujhse **bolkar ya likh kar** poochhiye: fasal ki ladai, khaad aur paani ke samay, keere rokne ke tarike, sarkari yojnayein — aur fasal ko **AgriEasy par bech kar paisa turant paane** ka rasta.\n\nPoora **sowing-se-selling plan** chahiye to **Plan** tab kholein.\n\nKaunsi fasal, kaunsa zila?"));
  }
  document.addEventListener("DOMContentLoaded", bindUI);
  return { send, toggleMic, retrieve, offlineAnswer, get settings() { return settings; } };
})();
