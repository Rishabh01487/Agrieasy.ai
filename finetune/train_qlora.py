#!/usr/bin/env python3
"""QLoRA fine-tune for the AgriEasy Saathi assistant (free-tier friendly).

Runs on Google Colab T4 / Kaggle T4x2 with unsloth. 4-bit base + LoRA adapters,
so up to ~8B params fits in 16GB VRAM. Default: Qwen2.5-1.5B-Instruct (fast v1;
also small enough to convert for in-browser WebLLM use later).

Usage:
    python train_qlora.py                       # 1.5B default, data/train.jsonl
    python train_qlora.py --model qwen3b        # 3B
    python train_qlora.py --model qwen7b --epochs 2
    HF_TOKEN=hf_xxx python train_qlora.py --model qwen3b --push --hf-repo YOURNAME/agrieasy-ai-v1
"""
import argparse, json, os
from pathlib import Path

MODELS = {
    "qwen1.5b": "unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit",
    "qwen3b":   "unsloth/Qwen2.5-3B-Instruct-bnb-4bit",
    "qwen7b":   "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    "llama8b":  "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",
}

def load_jsonl(p: Path):
    rows = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"loaded {len(rows)} examples from {p}")
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen1.5b", choices=list(MODELS))
    ap.add_argument("--data_dir", default=str(Path(__file__).parent / "data"))
    ap.add_argument("--out", default=str(Path(__file__).parent / "agrieasy-ai-v1"))
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--max_len", type=int, default=2048)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--grad_accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--push", action="store_true", help="push merged model to Hugging Face (needs HF_TOKEN)")
    ap.add_argument("--hf-repo", default=None)
    a = ap.parse_args()

    try:
        from unsloth import FastLanguageModel, is_bfloat16_supported
    except ImportError:
        raise SystemExit("unsloth not installed. On Colab: %pip install unsloth")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODELS[a.model], max_seq_length=a.max_len,
        dtype=None, load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model, r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16, lora_dropout=0, bias="none",
        use_gradient_checkpointing="unsloth", random_state=3407,
    )

    def to_text(ex):
        return {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False)}

    from datasets import Dataset
    train_ds = Dataset.from_list(load_jsonl(Path(a.data_dir) / "train.jsonl")).map(to_text)
    val_path = Path(a.data_dir) / "val.jsonl"
    val_ds = Dataset.from_list(load_jsonl(val_path)).map(to_text) if val_path.exists() else None

    from trl import SFTTrainer, SFTConfig
    cfg = SFTConfig(
        output_dir=str(Path(a.out) / "ckpt"),
        per_device_train_batch_size=a.batch,
        gradient_accumulation_steps=a.grad_accum,
        num_train_epochs=a.epochs,
        learning_rate=a.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=10,
        eval_strategy="steps" if val_ds else "no",
        eval_steps=50,
        save_steps=100,
        save_total_limit=2,
        bf16=is_bfloat16_supported(),
        fp16=not is_bfloat16_supported(),
        optim="adamw_8bit",
        weight_decay=0.01,
        seed=3407,
        report_to="none",
        max_seq_length=a.max_len,
        dataset_text_field="text",
        packing=False,
    )
    trainer = SFTTrainer(model=model, tokenizer=tokenizer, train_dataset=train_ds,
                         eval_dataset=val_ds, args=cfg)
    trainer.train()

    # quick smoke test
    FastLanguageModel.for_inference(model)
    msgs = [{"role": "user", "content": "Gehun me kangi kitni baar deni chahiye?"}]
    inputs = tokenizer.apply_chat_template(msgs, return_tensors="pt", add_generation_prompt=True).to("cuda")
    out = model.generate(input_ids=inputs, max_new_tokens=220, temperature=0.4)
    print("\n=== SMOKE TEST ===\n", tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))

    model.save_pretrained_merged(a.out, tokenizer, save_method="merged_16bit")
    print(f"merged model saved to {a.out}")

    if a.push:
        repo = a.hf_repo or f"{os.environ.get('HF_USERNAME','agrieasy')}/agrieasy-ai-v1"
        model.push_to_hub_merged(repo, tokenizer, save_method="merged_16bit",
                                 token=os.environ.get("HF_TOKEN"))
        print(f"pushed to https://huggingface.co/{repo}")

if __name__ == "__main__":
    main()
