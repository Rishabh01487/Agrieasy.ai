# Agrieasy.ai — AI Farm Assistant for agrieasy.site

An agriculture LLM assistant that answers **any farming question** and generates a **full-season plan from sowing to selling**, delivered as an installable **PWA named "Agrieasy.ai"** that works offline on a phone, and can even **download and run the AI model inside the browser** (WebGPU).

Built for the farmers who sell on **agrieasy.site**: guidance covers land preparation → sowing → nutrition/irrigation → pest & disease management → harvest → grading/packing → listing & selling on AgriEasy → getting paid efficiently.

---

## What's inside

```
agrieasy-ai/
├── README.md                  ← you are here
├── SETUP-ACCESS.md            ← the FREE platforms to grant/use (Colab, Kaggle, Hugging Face) + 1-month plan
├── SYSTEM_PROMPT.md           ← the assistant's "brain" (rules, tone, safety, selling guidance)
├── knowledge/                 ← agriculture knowledge base (RAG source + fine-tune source)
│   ├── crops_kharif.md        ← paddy, maize, cotton, soybean, sugarcane
│   ├── crops_rabi.md          ← wheat, mustard, chickpea, potato, onion
│   ├── crops_horticulture.md  ← tomato, chilli, banana
│   ├── yield_techniques.md    ← 20+ ways to increase yield
│   ├── post_harvest_marketing.md ← grading, packing, storage, MSP/eNAM, when to sell
│   ├── schemes_finance.md     ← PM-KISAN, KCC, PMFBY, Soil Health Card, PM-KUSUM, FPOs
│   └── selling_on_agrieasy.md ← step-by-step selling on AgriEasy + getting paid fast
├── finetune/                  ← free fine-tuning pipeline (runs on Google Colab / Kaggle)
│   ├── seed_qa.jsonl          ← hand-written seed Q&A pairs (English + a little Hindi)
│   ├── build_dataset.py       ← merges knowledge base + seed QA → train/val JSONL
│   ├── train_qlora.py         ← QLoRA fine-tune (Qwen2.5 1.5B / 3B / 7B, unsloth)
│   ├── Agrieasy_Finetune_Colab.ipynb ← one-click notebook for Colab/Kaggle
│   └── export_webllm.md       ← how the fine-tuned model gets into the PWA (in-browser)
└── app/                       ← the Agrieasy.ai PWA itself
    ├── index.html             ← installable chat + plan-generator UI
    ├── manifest.webmanifest   ← PWA manifest (name: "Agrieasy.ai")
    ├── sw.js                  ← offline service worker (app shell + knowledge base cached)
    ├── kb.js                  ← embedded knowledge base + crop data (works with zero network)
    ├── plan.js                ← deterministic sowing→selling plan generator
    ├── app.js                 ← chat logic: offline retrieval / in-browser WebLLM / cloud API
    ├── styles.css
    └── icons/
```

## The three answer modes (why it always works for a farmer)

| Mode | Needs internet? | What powers it |
|---|---|---|
| **Instant (offline)** | No | Keyword retrieval over the built-in knowledge base + plan generator |
| **On-device AI** | Only to download once | Qwen2.5-1.5B-Instruct running in-browser via WebLLM/WebGPU — the model is *downloaded by the PWA itself* |
| **Cloud AI** | Yes | Any OpenAI-compatible API (e.g. Groq free tier) with the Agrieasy system prompt + knowledge base as context (RAG) |

## Quick start (90 seconds)

```bash
cd agrieasy-ai/app
npx http-server -p 8080 .        # or any static server; Node: npx serve .
```

Open `http://127.0.0.1:8080`, chat with it, generate a crop plan, and use the
browser's "Install app" — it becomes **Agrieasy.ai** on the home screen, working offline.
For production, host the `app/` folder on any HTTPS static host (GitHub Pages / Netlify / Cloudflare Pages are free) and point it at your agrieasy.site domain.

## Fine-tuning (the "training" part) — free, in ~1 month

Read **SETUP-ACCESS.md**. Short version:

1. **Week 1** — this repo's knowledge base + seed dataset → fine-tune v1 of Qwen2.5-1.5B/3B with QLoRA on **free Google Colab** (T4 GPU).
2. **Week 2–3** — expand the dataset (add local crops/languages from your state agriculture university & KVK material), fine-tune v2, evaluate.
3. **Week 4** — export to WebLLM (in-browser) + GGUF (server), wire into the PWA and agrieasy.site.

**Honest limits:** no free service can train a frontier LLM "from scratch at maximum parameters" (that costs millions of dollars in GPUs). The free ceiling in one month is a **QLoRA fine-tune up to ~7–8B parameters** (Llama-3.1-8B / Qwen2.5-7B) on Colab/Kaggle — which, combined with this knowledge base (RAG), is exactly how every real agriculture chatbot is built.

## Disclaimers

Agronomy numbers here are **indicative, India-oriented recommendations** — always confirm rates/doses with your local KVK / agriculture officer and follow pesticide labels. Market prices are dynamic: the assistant directs users to live prices (eNAM / AgriEasy), never invents them.
