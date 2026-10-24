#!/usr/bin/env python3
"""Build the AgriEasy fine-tune dataset from the knowledge base + seed QA.

Usage:  python build_dataset.py [--kb_dir ../knowledge] [--out data]

Reads every .md file in kb_dir. For each crop/topic section it generates
question-answer pairs from the labeled bullets, merges seed_qa.jsonl,
dedups, shuffles and writes data/train.jsonl + data/val.jsonl in the
OpenAI-style {"messages":[...]} chat format.
"""
import argparse, json, random, re, sys
from pathlib import Path

SYSTEM = ("You are AgriEasy Saathi, the farming assistant of agrieasy.site. "
          "Answer in the user's language, in short simple bullets with quantities "
          "(kg/acre, days, Rs). Never invent daily market prices - point to live "
          "prices in the app. Pesticides: name active ingredient, say use as per "
          "label and confirm with KVK. Suspected pesticide poisoning: tell user to "
          "call 108/doctor immediately.")

# bullet label -> question template ({crop} is replaced)
LABEL_Q = {
    "season": "What is the sowing season and best time for {crop}?",
    "soil & land prep": "What soil and land preparation does {crop} need?",
    "seed rate & spacing": "What seed rate and spacing for {crop}?",
    "irrigation": "When and how should I irrigate {crop}?",
    "fertilizer": "What is the fertilizer schedule for {crop}?",
    "weeds": "How do I control weeds in {crop}?",
    "pests": "What are the major pests of {crop} and how to manage them?",
    "diseases": "What are the major diseases of {crop} and how to manage them?",
    "harvest": "When and how should I harvest {crop}?",
    "yield": "What yield can I expect from {crop}?",
    "post-harvest": "How should I handle and store {crop} after harvest?",
    "marketing": "How and when should I sell {crop} for the best price?",
}

def parse_kb(kb_dir: Path):
    """Yield (title, {label: text}) per '## ' section across all md files."""
    for md in sorted(kb_dir.glob("*.md")):
        text = md.read_text(encoding="utf-8")
        for chunk in re.split(r"\n## ", text):
            chunk = chunk.strip()
            if not chunk or chunk.startswith("#"):
                continue
            lines = chunk.splitlines()
            title = lines[0].strip()
            fields = {}
            for ln in lines[1:]:
                m = re.match(r"^-\s+\*\*(.+?):?\*\*:?\s*(.+)$", ln) or \
                    re.match(r"^-\s+(.+?):\s+(.+)$", ln)
                if m:
                    label = m.group(1).strip().rstrip(":").lower()
                    fields[label] = m.group(2).strip()
            if fields:
                yield title, fields

def clean(t: str) -> str:
    return re.sub(r"\s+", " ", t.replace("**", "")).strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kb_dir", default=str(Path(__file__).parent.parent / "knowledge"))
    ap.add_argument("--seed", default=str(Path(__file__).parent / "seed_qa.jsonl"))
    ap.add_argument("--out", default=str(Path(__file__).parent / "data"))
    ap.add_argument("--val_frac", type=float, default=0.05)
    a = ap.parse_args()

    pairs = []  # (question, answer)

    for title, fields in parse_kb(Path(a.kb_dir)):
        crop = clean(title.split("(")[0]).strip()
        for label, q in LABEL_Q.items():
            if label in fields:
                pairs.append((q.replace("{crop}", crop), f"**{crop} - {label.title()}:**\n\n{clean(fields[label])}"))
        # whole-guide pair
        guide = "\n".join(f"- **{clean(k).title()}**: {clean(v)}" for k, v in fields.items())
        pairs.append((f"Give me the complete guide for growing {crop} from sowing to selling.",
                      f"**{clean(title)} - complete guide (indicative; confirm with your KVK):**\n\n{guide}"))

    # seed QA as-is
    seed_path = Path(a.seed)
    n_seed = 0
    if seed_path.exists():
        for line in seed_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            q = next((m["content"] for m in rec["messages"] if m["role"] == "user"), None)
            ans = next((m["content"] for m in rec["messages"] if m["role"] == "assistant"), None)
            if q and ans:
                pairs.append((q, ans))
                n_seed += 1
    else:
        print(f"WARNING: seed file not found: {seed_path}")

    # dedup by question
    seen, unique = set(), []
    for q, ans in pairs:
        k = q.lower()
        if k not in seen:
            seen.add(k)
            unique.append((q, ans))

    random.seed(42)
    random.shuffle(unique)
    n_val = max(4, int(len(unique) * a.val_frac))
    splits = {"train": unique[n_val:], "val": unique[:n_val]}

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for split, rows in splits.items():
        with open(out / f"{split}.jsonl", "w", encoding="utf-8") as f:
            for q, ans in rows:
                f.write(json.dumps({"messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": q},
                    {"role": "assistant", "content": ans},
                ]}, ensure_ascii=False) + "\n")
        print(f"{split}: {len(rows)} examples -> {out / (split + '.jsonl')}")

    print(f"TOTAL: {len(unique)} unique ({n_seed} from seed QA, {len(unique)-n_seed} generated from {len(list(parse_kb(Path(a.kb_dir))))} KB sections)")

if __name__ == "__main__":
    sys.exit(main())
