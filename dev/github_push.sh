#!/usr/bin/env bash
# Push agrieasy-ai to GitHub and host the PWA free on GitHub Pages.
# Env: GITHUB_TOKEN (classic, repo scope), GITHUB_REPO="owner/name"
set -euo pipefail
: "${GITHUB_TOKEN:?set GITHUB_TOKEN}"
: "${GITHUB_REPO:?set GITHUB_REPO=owner/name}"
API="https://api.github.com"
AUTH="Authorization: Bearer $GITHUB_TOKEN"

code=$(curl -s -o /tmp/gh_repo.json -w '%{http_code}' "$API/repos/$GITHUB_REPO" -H "$AUTH")
if [ "$code" != "200" ]; then
  echo "creating repo ${GITHUB_REPO#*/}..."
  curl -s -X POST "$API/user/repos" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"name\":\"${GITHUB_REPO#*/}\",\"private\":false,\"description\":\"Agrieasy.ai - AI farm assistant PWA + free fine-tuning pipeline\"}" | head -c 300; echo
fi

cd "$(dirname "$0")/.."
git init -q
git config user.email  "223614585+Rishabh01487@users.noreply.github.com"
git config user.name   "Rishabh Gupta"
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
printf 'node_modules/\n*.pyc\nfinetune/data/\nfinetune/agrieasy-ai-v1/\nfinetune/**/ckpt/\n.env\n' > .gitignore
git add -A
git commit -qm "Agrieasy.ai: PWA, knowledge base, training pipeline" || true
git branch -M main
git push -qf origin main
echo "pushed -> https://github.com/$GITHUB_REPO"

# Host the PWA at https://owner.github.io/repo/ (free HTTPS)
pages=$(curl -s -o /tmp/gh_pages.json -w '%{http_code}' "$API/repos/$GITHUB_REPO/pages" -H "$AUTH")
if [ "$pages" != "200" ]; then
  curl -s -X POST "$API/repos/$GITHUB_REPO/pages" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"source":{"branch":"main","path":"/app"}}' | head -c 300; echo
else
  curl -s -X PUT "$API/repos/$GITHUB_REPO/pages" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"source":{"branch":"main","path":"/app"}}' | head -c 120; echo
fi
echo "PWA live at: https://${GITHUB_REPO%/*}.github.io/${GITHUB_REPO#*/}/  (first build takes ~1 min)"
