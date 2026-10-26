#!/usr/bin/env python3
"""Plain QLoRA fine-tune using ONLY preinstalled libs (transformers, peft, datasets, bitsandbytes).
Zero pip installs — fallback for environments where unsloth/trl installs hang (e.g. py3.13).
Usage mirrors train_qlora.py."""
import argparse, json, os, sys
from pathlib import Path

# Kaggle py3.13 image ships torchao 0.10 but transformers wants >0.16 (torchao is only
# used for quantized loads — we train fp16). Neutralize it so transformers skips those paths.
import types as _types
sys.modules["torchao"] = _types.ModuleType("torchao")
sys.modules["torchao"].__version__ = "0.19.0"

MODELS = {
    "qwen1.5b": "Qwen/Qwen2.5-1.5B-Instruct",
    "qwen3b":   "Qwen/Qwen2.5-3B-Instruct",
    "qwen7b":   "Qwen/Qwen2.5-7B-Instruct",
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen1.5b", choices=list(MODELS))
    ap.add_argument("--data_dir", default="finetune/data")
    ap.add_argument("--out", default="finetune/agrieasy-ai-v1")
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--max_len", type=int, default=1024)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--grad_accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--hf-repo", default=None)
    ap.add_argument("--model_path", default=None, help="local base model dir (e.g. Kaggle Models mount); overrides --model")
    ap.add_argument("--load4bit", action="store_true", help="needs bitsandbytes (not preinstalled on Kaggle py3.13); default fp16 works for <=3B on T4")
    a = ap.parse_args()
    base = a.model_path or MODELS[a.model]

    import torch
    from transformers import (AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig,
                              Trainer, TrainingArguments, DataCollatorForLanguageModeling)
    from peft import LoraConfig, get_peft_model
    from datasets import Dataset

    print("loading", base, flush=True)
    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    if a.load4bit:
        bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=torch.float16)
        model = AutoModelForCausalLM.from_pretrained(
            base, quantization_config=bnb, device_map={"": 0}, torch_dtype=torch.float16)
    else:
        model = AutoModelForCausalLM.from_pretrained(base, torch_dtype=torch.float16)
        model = model.to("cuda")
    model.config.use_cache = False
    try:
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    except TypeError:
        model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    lcfg = LoraConfig(r=16, lora_alpha=16, lora_dropout=0, bias="none", task_type="CAUSAL_LM",
                      target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                      "gate_proj", "up_proj", "down_proj"])
    model = get_peft_model(model, lcfg)
    model.print_trainable_parameters()

    def to_text(ex):
        return {"text": tok.apply_chat_template(ex["messages"], tokenize=False)}
    def tok_fn(ex):
        out = tok(ex["text"], truncation=True, max_length=a.max_len)
        out["labels"] = list(out["input_ids"])
        return out

    train = (Dataset.from_list([json.loads(l) for l in open(Path(a.data_dir) / "train.jsonl")])
             .map(to_text).map(tok_fn, remove_columns=["messages", "text"]))
    val_p = Path(a.data_dir) / "val.jsonl"
    val = None
    if val_p.exists():
        val = (Dataset.from_list([json.loads(l) for l in open(val_p)])
               .map(to_text).map(tok_fn, remove_columns=["messages", "text"]))
    print(f"train={len(train)} val={len(val) if val else 0}", flush=True)

    targs = dict(
        output_dir=str(Path(a.out) / "ckpt"), per_device_train_batch_size=a.batch,
        gradient_accumulation_steps=a.grad_accum, num_train_epochs=a.epochs,
        learning_rate=a.lr, lr_scheduler_type="cosine", warmup_ratio=0.03,
        logging_steps=5, eval_steps=50, save_steps=100, save_total_limit=1,
        fp16=True, optim="adamw_torch", weight_decay=0.01, seed=3407, report_to="none")
    try:
        args = TrainingArguments(eval_strategy="steps" if val else "no", **targs)
    except TypeError:  # older transformers
        args = TrainingArguments(evaluation_strategy="steps" if val else "no", **targs)

    trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=val,
                      data_collator=DataCollatorForLanguageModeling(tok, mlm=False))
    trainer.train()

    model = model.merge_and_unload()
    model.save_pretrained(a.out, safe_serialization=True)
    tok.save_pretrained(a.out)
    print("merged model saved to", a.out, flush=True)

    if a.push and os.environ.get("HF_TOKEN") and a.hf_repo:
        from huggingface_hub import HfApi, create_repo
        token = os.environ["HF_TOKEN"]
        create_repo(a.hf_repo, exist_ok=True, token=token)
        HfApi(token=token).upload_folder(folder_path=a.out, repo_id=a.hf_repo,
                                         repo_type="model", commit_message="agrieasy-ai v1")
        print("pushed to https://huggingface.co/" + a.hf_repo, flush=True)

if __name__ == "__main__":
    sys.exit(main())
