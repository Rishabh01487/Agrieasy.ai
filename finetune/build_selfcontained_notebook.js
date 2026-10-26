// Build the self-contained training notebook from current source files.
// Run from finetune/:  node build_selfcontained_notebook.js
// KEEP this file — it regenerates the notebook whenever knowledge/ or trainer changes.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");

const files = {};
const add = p => { files[p] = fs.readFileSync(path.join(ROOT, p), "utf8"); };
for (const f of fs.readdirSync(path.join(ROOT, "knowledge")).filter(f => f.endsWith(".md"))) add(path.join("knowledge", f));
add("finetune/seed_qa.jsonl");
add("finetune/build_dataset.py");
add("finetune/train_lora_plain.py");
const manifestB64 = Buffer.from(JSON.stringify(files)).toString("base64");

const SHIM = [
  "import sys, types, importlib.util\n",
  "_s = importlib.util.spec_from_loader('torchao', loader=None)\n",
  "_m = types.ModuleType('torchao'); _m.__spec__ = _s; _m.__version__ = '0.19.0'\n",
  "sys.modules['torchao'] = _m\n"
].join("");

const cell = (type, src) => ({ cell_type: type, metadata: {}, source: Array.isArray(src) ? src : src.split("\n").map((l, i, a) => l + (i < a.length - 1 ? "\n" : "")) });

const nb = {
  cells: [
    cell("markdown", "# AgriEasy Saathi — self-contained fine-tune (no internet needed)\n\nSource embedded below; base model from attached Kaggle Model `qwen-lm/qwen2.5/transformers/1.5b-instruct`. fp16 LoRA on preinstalled libraries only. Output: `/kaggle/working/agrieasy-ai-v1`."),
    cell("code", [
      "# 1) stack check (no installs)\n", SHIM,
      "import torch, transformers, peft, datasets, os, glob, json, base64, pathlib\n",
      "print('stack ok | GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE')"
    ]),
    cell("code", [
      "# 2) unpack embedded source + locate attached base model\n",
      `SRC = json.loads(base64.b64decode("${manifestB64}"))\n`,
      "for p, c in SRC.items():\n",
      "    pathlib.Path(p).parent.mkdir(parents=True, exist_ok=True)\n",
      "    pathlib.Path(p).write_text(c, encoding='utf-8')\n",
      "print('source unpacked:', len(SRC), 'files')\n",
      "cands = [os.path.dirname(p) for p in glob.glob('/kaggle/input/**/config.json', recursive=True) if 'qwen' in p.lower()]\n",
      "assert cands, 'attached qwen model not found'\n",
      "BASE = cands[0]\n",
      "print('base model:', BASE)"
    ]),
    cell("code", [
      "# 3) build dataset\n",
      "import subprocess\n",
      "r = subprocess.run('python finetune/build_dataset.py --kb_dir knowledge --seed finetune/seed_qa.jsonl --out finetune/data', shell=True, capture_output=True, text=True)\n",
      "print(r.stdout, r.stderr)\n",
      "assert r.returncode == 0, 'dataset build failed'"
    ]),
    cell("code", [
      "# 4) train (fp16 LoRA) — merged model saved to /kaggle/working/agrieasy-ai-v1\n",
      "r = subprocess.run(f\"python finetune/train_lora_plain.py --model_path '{BASE}' --data_dir finetune/data --out /kaggle/working/agrieasy-ai-v1\", shell=True)\n",
      "print('train exit:', r.returncode)\n",
      "assert r.returncode == 0, 'training failed'"
    ]),
    cell("code", [
      "# 5) smoke test the fine-tuned model\n", SHIM,
      "import torch\n",
      "from transformers import AutoModelForCausalLM, AutoTokenizer\n",
      "tok = AutoTokenizer.from_pretrained('/kaggle/working/agrieasy-ai-v1')\n",
      "model = AutoModelForCausalLM.from_pretrained('/kaggle/working/agrieasy-ai-v1', torch_dtype=torch.float16).to('cuda')\n",
      "q = 'Meri gehun ki 2 ekad zameen hai, poora plan banayein beej se bikri tak'\n",
      "ids = tok.apply_chat_template([{'role':'user','content':q}], return_tensors='pt', add_generation_prompt=True).to('cuda')\n",
      "out = model.generate(input_ids=ids, max_new_tokens=250, temperature=0.5, do_sample=True)\n",
      "print('=== SMOKE TEST ===')\n",
      "print(tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True))"
    ])
  ],
  metadata: { accelerator: "GPU", kernelspec: { display_name: "Python 3", language: "python", name: "python3" }, language_info: { name: "python" } },
  nbformat: 4, nbformat_minor: 5
};

fs.writeFileSync(path.join(__dirname, "Agrieasy_Finetune_Colab.ipynb"), JSON.stringify(nb, null, 1));
const check = JSON.parse(fs.readFileSync(path.join(__dirname, "Agrieasy_Finetune_Colab.ipynb"), "utf8"));
console.log("notebook built | cells:", check.cells.length, "| payload KB:", Math.round(manifestB64.length / 1024), "| spec shim:", check.cells[1].source.join("").includes("__spec__"));
