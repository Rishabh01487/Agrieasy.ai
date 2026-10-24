#!/usr/bin/env bash
# Poll the AgriEasy kernel + fetch logs/outputs.
# Env: KAGGLE_KEY (KGAT token or classic key; set KAGGLE_USERNAME only for classic keys).
#      KAGGLE_OWNER defaults to KAGGLE_USERNAME.  Usage: ./kaggle_status.sh [watch]
set -euo pipefail
: "${KAGGLE_KEY:?set KAGGLE_KEY}"
if [ -n "${KAGGLE_USERNAME:-}" ]; then AUTH=(-u "$KAGGLE_USERNAME:$KAGGLE_KEY"); else AUTH=(-H "Authorization: Bearer $KAGGLE_KEY"); fi
OWNER="${KAGGLE_OWNER:-agrieasyai}"
SLUG="agrieasy-finetune"
BASE="https://www.kaggle.com/api/v1"

status() { curl -s "${AUTH[@]}" "$BASE/kernels/status?userName=$OWNER&kernelSlug=$SLUG"; }

if [ "${1:-}" = "watch" ]; then
  while :; do s=$(status); echo "$(date +%H:%M) $s";
    echo "$s" | grep -qE '"(complete|error|cancelAcknowledged)"' && break; sleep 120; done
else
  status; echo
  echo "--- log/output ---"
  curl -s "${AUTH[@]}" "$BASE/kernels/output?userName=$OWNER&kernelSlug=$SLUG" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log((j.log||'').split('\n').slice(-40).join('\n'));(j.files||[]).forEach(f=>console.log('FILE:',f.fileName,f.url));}catch(e){console.log(d.slice(0,2000))}})"
fi
