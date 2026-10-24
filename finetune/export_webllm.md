# Getting the model into the Agrieasy.ai PWA (and onto a server)

## Path A — v1 (ships today, zero conversion)
The PWA already runs **stock Qwen2.5-1.5B-Instruct in-browser** via WebLLM (modelId
`Qwen2.5-1.5B-Instruct-q4f16_1-MLC`). Its agriculture behaviour comes from:
1. the AgriEasy system prompt (SYSTEM_PROMPT.md), and
2. **RAG**: relevant chunks of `knowledge/*.md` injected into the prompt per question.

This is how the app is accurate on day 1. Fine-tuning (Path B) then makes the
*style and defaults* agricultural, not just the context.

## Path B — your fine-tuned weights in the browser (v2)
WebLLM loads MLC-compiled models, including private HF repos (`modelId: "hf://<user>/<repo>"`).

After `train_qlora.py` produced `agrieasy-ai-v1/` (merged 1.5B) and pushed it to HF:

```bash
pip install --pre -U mlc-ai-nightly mlc-llm-nightly   # on Colab GPU runtime
python -m mlc_llm convert_weight ./agrieasy-ai-v1/ \
    --quantization q4f16_1 -o ./dist/ --device cpu
python -m mlc_llm compile ./dist/mlc-chat-config.json \
    --device webgpu -o ./dist/agrieasy_qwen1.5b.wasm
# upload dist/ (wasm + params + config + tokenizer) to the SAME HF repo
```

Then in `app/app.js` change:
```js
modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
```
to
```js
modelId: "hf://YOURNAME/agrieasy-ai-v1-q4f16_1-MLC"
```
WebLLM downloads your weights into the PWA cache on first "Download AI model" —
exactly the "model downloaded by the Agrieasy.ai PWA" requirement.

Notes: WebGPU needed (Chrome/Edge 113+ on Android 12+/desktop; the app auto-detects and
falls back to retrieval mode). Keep 1.5B for phones; 3B works on 8GB-RAM flagships.

## Path C — server/GGUF (for agrieasy.site backend + cheap VPS)
```bash
python -m pip install llama-cpp-python[server]   # plus its convert script repo
python convert_hf_to_gguf.py ./agrieasy-ai-v1 --outfile agrieasy-v1-f16.gguf
./llama-quantize agrieasy-v1-f16.gguf agrieasy-v1-q4_k_m.gguf Q4_K_M
llama-server -m agrieasy-v1-q4_k_m.gguf --port 8080   # OpenAI-compatible API
```
Point the PWA's Cloud mode settings at `http://your-server:8080/v1` — any 2–4 GB RAM
VPS (~₹300–500/month) serves a 1.5B–3B fine-tune for thousands of chats/day.

## Which path when?
- **Launch (week 1):** Path A PWA + optional free Groq API for big-model quality.
- **Week 2–3:** fine-tuned 3B on HF (inference via free HF Inference or Path C VPS).
- **Week 4:** Path B WebLLM build so the *fine-tuned* model lives inside the PWA offline.
