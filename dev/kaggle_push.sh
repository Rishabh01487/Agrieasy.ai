#!/usr/bin/env bash
# Start the AgriEasy fine-tune as a PRIVATE GPU kernel on Kaggle (free 30 GPU-hrs/week).
# Env: KAGGLE_KEY (new-style KGAT_ token, sent as Bearer; or classic key with KAGGLE_USERNAME for basic auth),
#      REPO_URL (git URL the kernel clones — HF source repo or GitHub), KAGGLE_HF_TOKEN + HF_USERNAME (optional model push)
set -euo pipefail
: "${KAGGLE_KEY:?set KAGGLE_KEY}"
if [ -n "${KAGGLE_USERNAME:-}" ]; then AUTH=(-u "$KAGGLE_USERNAME:$KAGGLE_KEY"); else AUTH=(-H "Authorization: Bearer $KAGGLE_KEY"); fi
REPO_URL="${REPO_URL:-https://github.com/CHANGE-ME/agrieasy-ai}"
HF_TOKEN="${KAGGLE_HF_TOKEN:-}"
HF_USER="${HF_USERNAME:-}"
SLUG="agrieasy-finetune"   # derived server-side from newTitle (do NOT send slug in payload — API rejects it)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# working copy of the notebook, patched with the real repo URL (+ HF push, if provided)
# (relative paths only — Git Bash /tmp is invisible to Windows node/curl)
NB="$ROOT/finetune/.nb_patched.ipynb"
PAYLOAD="$ROOT/finetune/.kaggle_payload.json"
cp "$ROOT/finetune/Agrieasy_Finetune_Colab.ipynb" "$NB"
sed -i "s|https://github.com/CHANGE-ME/agrieasy-ai|$REPO_URL|" "$NB"

cd "$ROOT"
REPO_URL="$REPO_URL" HF_TOKEN="$HF_TOKEN" HF_USER="$HF_USER" SLUG="$SLUG" KERNEL_ID="${KAGGLE_KERNEL_ID:-}" NB="finetune/.nb_patched.ipynb" PAYLOAD="finetune/.kaggle_payload.json" node -e '
const fs = require("fs");
const nbPath = process.env.NB, payPath = process.env.PAYLOAD;
let nb = JSON.parse(fs.readFileSync(nbPath, "utf8"));
const patch = (find, repl) => nb.cells.forEach(c => (c.source = c.source.map(l => l.replace(find, repl))));
if (process.env.REPO_URL && !process.env.REPO_URL.includes("CHANGE-ME")) patch("https://github.com/CHANGE-ME/agrieasy-ai", process.env.REPO_URL);
if (process.env.HF_TOKEN) { patch("HF_TOKEN = \"\"", "HF_TOKEN = \""+process.env.HF_TOKEN+"\"");
  patch("HF_REPO  = \"\"", "HF_REPO  = \""+process.env.HF_USER+"/agrieasy-ai-v1\""); }
fs.writeFileSync(payPath, JSON.stringify(Object.assign({
  newTitle: "AgriEasy Finetune",
  text: JSON.stringify(nb),
  language: "python", kernelType: "notebook",
  isPrivate: true, enableGpu: true, enableInternet: true,
  datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: []
}, process.env.KERNEL_ID ? { id: Number(process.env.KERNEL_ID) } : {})));'

echo "pushing kernel $SLUG ..."
curl -s "${AUTH[@]}" -H 'Content-Type: application/json' \
  --data @"$PAYLOAD" "https://www.kaggle.com/api/v1/kernels/push" | tee "$ROOT/finetune/.kaggle_push_resp.json"
echo
echo "poll with:  ./kaggle_status.sh watch"
echo "NOTE: KAGGLE_HF_TOKEN is baked into the private kernel for the HF push step; revoke that HF token after training."
