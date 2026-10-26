---
license: apache-2.0
base_model: Qwen/Qwen2.5-1.5B-Instruct
tags:
- agriculture
- farming
- india
- agrieasy
- conversational
language:
- en
- hi
---

# AgriEasy Saathi v1 (agrieasy-ai-v1)

AgriEasy's own farming assistant model — a fp16 LoRA fine-tune of **Qwen2.5-1.5B-Instruct** (Apache-2.0), trained on the AgriEasy agriculture knowledge base: 12 Indian crop guides (sowing → selling), yield techniques, post-harvest & marketing, government schemes, selling on agrieasy.site, plus multi-turn Hinglish farmer conversations (clarifying questions, fragmented voice input, agent-style listing/transport/payment flows).

**Training** (Kaggle T4, fp16 LoRA): 15 steps × 3 epochs, lr 2e-4 (cosine), r=16 on all attention+MLP projections. train_loss 3.19 · eval_loss 2.397.

**Intended use:** power the Agrieasy.ai PWA and agrieasy.site assistant. Answers are indicative guidance for Indian farmers — always confirm doses with a local KVK; the assistant never invents daily market prices.

**Limitations:** small model (1.5B); deep agronomy numbers come from the app's retrieval knowledge base at answer time, not from weights alone. Not a source of medical/legal/emergency advice (it directs to 108 / Kisan Call Centre 1800-180-1551).
