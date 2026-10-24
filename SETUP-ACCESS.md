# SETUP & ACCESS — free training in 1 month (what to grant, what's realistic)

You asked to be connected to a **free training platform with maximum parameters in 1 month**. Here is the honest, practical answer, plus exactly what to set up.

## Reality check (read once)

| Goal | Feasible free? | Notes |
|---|---|---|
| Train a frontier LLM from scratch (70B+, "maximum parameters") | ❌ Never free | Costs $1M–$100M+ in GPU time, thousands of GPUs for months |
| Fine-tune an existing open model up to **7–8B** params (QLoRA) | ✅ Yes, free | **This is the plan.** Colab T4 or Kaggle 2×T4 |
| Fine-tune a **1.5–3B** model that runs *inside the PWA on a phone* | ✅ Yes, free | WebLLM/WebGPU path — matches your "model downloaded by Agrieasy.ai PWA" requirement |
| Make it expert in agriculture | ✅ Yes | Fine-tune + the `knowledge/` base used as RAG context. This combo is how real agri-chatbots work |

**Recommended target model: Qwen2.5-3B-Instruct** (Apache-2.0, strong, multilingual incl. Hindi).
On-device PWA model: **Qwen2.5-1.5B-Instruct** via WebLLM.

## The 3 free accounts to create (5 minutes)

### 1. Google Colab — free GPU (main trainer)
- Go to https://colab.research.google.com → sign in with any Google account.
- Open `finetune/Agrieasy_Finetune_Colab.ipynb` (File → Upload notebook).
- Menu: **Runtime → Change runtime type → T4 GPU** → Save.
- Run all cells. That's it — it fine-tunes `train_qlora.py` end-to-end (~1–3 h for 1.5B, ~3–5 h for 3B on the free T4).
- Free limits: sessions ~ up to 4–12 h, may disconnect; checkpoints are saved to Google Drive so nothing is lost.

### 2. Kaggle — free 30 GPU-hours/week (the upgrade path)
- https://www.kaggle.com → sign in → Settings → create **API token** / phone-verify for GPUs.
- Upload the same notebook (File → Import Notebook) → Settings → Accelerator: **GPU T4 ×2**.
- Use it for the bigger 7B run in week 3 and for long dataset-generation runs.

### 3. Hugging Face — free model & dataset hosting
- https://huggingface.co → sign up.
- Profile → Settings → **Access Tokens → New token** (type: *write*, fine-grained, only `repos: write`).
- Paste the token into the Colab notebook's `HF_TOKEN` field — it uploads your dataset and the finished `agrieasy-ai-v1` model to your HF account automatically (free hosting, shareable link, free Spaces demo page).

### Optional 4. Groq — free fast cloud API (instant live chat mode)
- https://console.groq.com → sign up → API Keys → create free key.
- Paste it into the PWA's ⚙ Settings → Cloud mode. The app can use a big open cloud model at a free tier (model name configurable in Settings) — no training needed for this mode at all.

## ⚠️ Security rules (important)

- **Never share account passwords.** Only Hugging Face/Groq **tokens**, and treat them like bank PINs.
- Fine-grained HF token with only `repos: write`; **revoke** it after training (`Settings → Access Tokens → Revoke`).
- If a token ever leaks, revoke immediately — tokens can write to your repos, nothing more.

## The 1-month schedule

| Week | Work | Where |
|---|---|---|
| 1 | Test PWA v1 (offline mode). Run Colab notebook → fine-tuned **v1** (1.5B, seed dataset ~1–2k pairs). Try it on 20 real farmer questions. | Colab + app/ |
| 2 | Grow the dataset: add your district's crops, local language Q&A, AgriEasy's real listing/selling screenshots & flow → 5–10k pairs (notebook can generate/expand via the base model, still free). Fine-tune **v2 = Qwen2.5-3B**. | Colab/Kaggle |
| 3 | Bigger model **v3 = Qwen2.5-7B / Llama-3.1-8B** (Kaggle T4×2, QLoRA). Blind-test all three versions on 100 real questions; keep the best. | Kaggle |
| 4 | Export winner: WebLLM build for in-PWA download + GGUF for a small server. Host PWA on HTTPS (GitHub Pages/Netlify free) → link/embed on agrieasy.site. | HF + hosting |

## After setup — sanity checks

1. Check the Colab notebook ran to the end without errors.
2. Your HF username (dataset/model lives at `huggingface.co/<you>/agrieasy-ai-v1`).
3. Add your real AgriEasy listing/selling flow details to customize `knowledge/selling_on_agrieasy.md`.
